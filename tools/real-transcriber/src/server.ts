// Real Kotomi Transcriber — WebSocket server with pluggable ASR backend.
//
// Listens on ws://127.0.0.1:8765/v1/transcribe/stream (same endpoint as mock-transcriber).
// Uses an ASRAdapter for actual speech recognition.
//
// Environment variables:
//   TRANSCRIBER_BACKEND — "mock" (default) | "faster-whisper"
//   TRANSCRIBER_PORT     — WebSocket server port (default: 8765)
//   CHUNKS_PER_SEGMENT   — How many audio chunks to collect before transcribing (default: 3)

import { WebSocketServer, WebSocket } from "ws";
import type { ASRAdapter } from "./asr-adapter";
import { MockAdapter } from "./adapters/mock-adapter";
import { FasterWhisperAdapter } from "./adapters/faster-whisper-adapter";

const PORT = parseInt(process.env.TRANSCRIBER_PORT ?? "8765", 10);
const PATH = "/v1/transcribe/stream";
const CHUNKS_PER_SEGMENT = parseInt(process.env.CHUNKS_PER_SEGMENT ?? "3", 10);

interface Session {
  ws: WebSocket;
  sessionId: string;
  chunkBuffers: Buffer[];
  chunkTimestamps: number[];
  chunkStartMs: number;   // timestamp of first chunk in current batch
}

const sessions = new Map<string, Session>();
let segmentCounter = 1;

function sendJSON(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function createSegment(sessionId: string, text: string, startMs: number, endMs: number, confidence?: number) {
  return {
    type: "transcript.segment",
    sessionId,
    segmentId: `seg-${String(segmentCounter++).padStart(4, "0")}`,
    startMs,
    endMs,
    text,
    isFinal: true,
    confidence: confidence ?? 0.9,
    speaker: null,
  };
}

async function loadAdapter(): Promise<ASRAdapter> {
  const backend = (process.env.TRANSCRIBER_BACKEND ?? "mock").toLowerCase();

  switch (backend) {
    case "mock":
      return new MockAdapter();
    case "faster-whisper":
      return new FasterWhisperAdapter();
    default:
      console.warn(`[real-transcriber] unknown backend "${backend}", falling back to mock`);
      return new MockAdapter();
  }
}

async function processBatch(session: Session, adapter: ASRAdapter): Promise<void> {
  if (session.chunkBuffers.length === 0) return;

  // Concatenate all chunks in the batch
  const combined = Buffer.concat(session.chunkBuffers);
  const startMs = session.chunkStartMs;
  const endMs = session.chunkTimestamps[session.chunkTimestamps.length - 1] ?? Date.now();

  try {
    const result = await adapter.transcribe(combined, "audio/webm;codecs=opus");
    const segment = createSegment(session.sessionId, result.text, startMs, endMs, result.confidence);
    sendJSON(session.ws, segment);
    console.log(`[real-transcriber] → transcript.segment: "${result.text}"`);
  } catch (err) {
    console.error(`[real-transcriber] ASR failed for session ${session.sessionId}:`, err);
    sendJSON(session.ws, {
      type: "transcriber.error",
      sessionId: session.sessionId,
      message: `ASR transcription failed: ${err}`,
    });
  }

  // Reset batch
  session.chunkBuffers = [];
  session.chunkTimestamps = [];
}

async function main(): Promise<void> {
  const backendLabel = process.env.TRANSCRIBER_BACKEND ?? "mock";
  console.log(`[real-transcriber] starting with backend: ${backendLabel}`);

  let adapter = await loadAdapter();

  try {
    await adapter.initialize();
  } catch (err) {
    console.error(`[real-transcriber] failed to initialize adapter "${adapter.name}": ${err}`);
    console.log(`[real-transcriber] falling back to mock`);
    process.env.TRANSCRIBER_BACKEND = "mock";
    adapter = new MockAdapter();
    await adapter.initialize();
  }

  const wss = new WebSocketServer({ port: PORT, path: PATH });

  wss.on("listening", () => {
    console.log(`[real-transcriber] listening on ws://127.0.0.1:${PORT}${PATH}`);
  });

  wss.on("error", (err) => {
    console.error("[real-transcriber] server error:", err);
  });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[real-transcriber] client connected");

    let currentSession: Session | null = null;

    ws.on("message", (data: Buffer) => {
      // Try JSON first
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case "transcription.session.start":
            console.log(`[real-transcriber] session.start: ${msg.sessionId}`);
            currentSession = {
              ws,
              sessionId: msg.sessionId,
              chunkBuffers: [],
              chunkTimestamps: [],
              chunkStartMs: 0,
            };
            sessions.set(msg.sessionId, currentSession);

            sendJSON(ws, {
              type: "transcriber.state",
              status: "connected",
              sessionId: msg.sessionId,
            });
            break;

          case "transcription.audio.chunk": {
            // JSON metadata received — binary chunk will follow
            if (currentSession) {
              console.log(
                `[real-transcriber] audio.chunk #${msg.chunkIndex} for ${msg.sessionId}`,
              );

              // Store timestamp for this chunk (binary data will be added by the binary handler)
              if (currentSession.chunkBuffers.length === 0) {
                currentSession.chunkStartMs = msg.timestampMs;
              }
              currentSession.chunkTimestamps.push(msg.timestampMs);
            }
            break;
          }

          case "transcription.session.stop":
            console.log(
              `[real-transcriber] session.stop: ${msg.sessionId} reason=${msg.reason}`,
            );
            // Process any remaining chunks
            if (currentSession && currentSession.chunkBuffers.length > 0) {
              processBatch(currentSession, adapter);
            }
            sessions.delete(msg.sessionId);
            break;

          default:
            console.log("[real-transcriber] unknown message type:", msg.type);
        }

        return;
      } catch {
        // Not JSON — treat as binary audio data
        if (currentSession) {
          currentSession.chunkBuffers.push(Buffer.from(data));
          console.log(
            `[real-transcriber] binary frame: ${data.byteLength} bytes (buffered: ${currentSession.chunkBuffers.length}/${CHUNKS_PER_SEGMENT} chunks)`,
          );

          // Check if we've accumulated enough chunks for a batch
          if (currentSession.chunkBuffers.length >= CHUNKS_PER_SEGMENT) {
            processBatch(currentSession, adapter);
          }
        }
      }
    });

    ws.on("close", () => {
      console.log("[real-transcriber] client disconnected");
      if (currentSession) {
        sessions.delete(currentSession.sessionId);
      }
    });

    ws.on("error", (err) => {
      console.error("[real-transcriber] client error:", err);
      if (currentSession) {
        sessions.delete(currentSession.sessionId);
      }
    });
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[real-transcriber] shutting down...");
    wss.close(() => {
      adapter.shutdown().finally(() => process.exit(0));
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
