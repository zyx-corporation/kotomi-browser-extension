// Mock Kotomi Transcriber — WebSocket server for local development.
// Listens on ws://127.0.0.1:8765/v1/transcribe/stream
// Accepts transcription.session.start, transcription.audio.chunk (JSON + binary), transcription.session.stop
// Returns mock transcript.segment messages every few chunks

import { WebSocketServer, WebSocket } from "ws";

const PORT = 8765;
const PATH = "/v1/transcribe/stream";

interface Session {
  ws: WebSocket;
  sessionId: string;
  chunkCount: number;
}

const sessions = new Map<string, Session>();
let segmentCounter = 1;

const mockTexts = [
  "これは Kotomi の文字起こしテストです。",
  "現在タブの音声を取得しています。",
  "ブラウザ拡張から WebSocket 経由で音声チャンクを送信しています。",
  "このテストメッセージは mock transcriber によって生成されています。",
  "実際の ASR エンジンに置き換えることで、本格的な文字起こしが可能になります。",
  "Kotomi はローカル環境で動作する文字起こしツールです。",
];

function createSegment(sessionId: string, text: string, startMs: number, endMs: number) {
  return {
    type: "transcript.segment",
    sessionId,
    segmentId: `seg-${String(segmentCounter++).padStart(4, "0")}`,
    startMs,
    endMs,
    text,
    isFinal: true,
    confidence: 0.95 + Math.random() * 0.04,
    speaker: null,
  };
}

function sendJSON(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

const wss = new WebSocketServer({ port: PORT, path: PATH });

wss.on("listening", () => {
  console.log(`[mock-transcriber] listening on ws://127.0.0.1:${PORT}${PATH}`);
});

wss.on("error", (err) => {
  console.error("[mock-transcriber] server error:", err);
});

wss.on("connection", (ws: WebSocket) => {
  console.log("[mock-transcriber] client connected");

  let currentSession: Session | null = null;

  ws.on("message", (data: Buffer) => {
    // Try JSON first
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case "transcription.session.start":
          console.log(`[mock-transcriber] session.start: ${msg.sessionId}`);
          currentSession = {
            ws,
            sessionId: msg.sessionId,
            chunkCount: 0,
          };
          sessions.set(msg.sessionId, currentSession);

          // Send ack
          sendJSON(ws, {
            type: "transcriber.state",
            status: "connected",
            sessionId: msg.sessionId,
          });
          break;

        case "transcription.audio.chunk":
          // JSON metadata received — binary chunk follows
          if (currentSession) {
            currentSession.chunkCount++;
            console.log(
              `[mock-transcriber] audio.chunk #${msg.chunkIndex} for ${msg.sessionId} (total chunks: ${currentSession.chunkCount})`,
            );

            // Generate mock segment every 3 chunks
            if (currentSession.chunkCount % 3 === 0) {
              const textIndex = ((currentSession.chunkCount / 3 - 1) % mockTexts.length);
              const text = mockTexts[textIndex];
              const startMs = (currentSession.chunkCount - 3) * 1000;
              const endMs = currentSession.chunkCount * 1000;
              const segment = createSegment(msg.sessionId, text, startMs, endMs);

              setTimeout(() => {
                sendJSON(currentSession!.ws, segment);
                console.log(`[mock-transcriber] → transcript.segment: "${text}"`);
              }, 200);
            }
          }
          break;

        case "transcription.session.stop":
          console.log(
            `[mock-transcriber] session.stop: ${msg.sessionId} reason=${msg.reason}`,
          );
          sessions.delete(msg.sessionId);
          break;

        default:
          console.log("[mock-transcriber] unknown message type:", msg.type);
      }

      return;
    } catch {
      // Not JSON — treat as binary audio data
      // console.log(`[mock-transcriber] binary frame: ${data.byteLength} bytes`);
    }
  });

  ws.on("close", () => {
    console.log("[mock-transcriber] client disconnected");
    if (currentSession) {
      sessions.delete(currentSession.sessionId);
    }
  });

  ws.on("error", (err) => {
    console.error("[mock-transcriber] client error:", err);
    if (currentSession) {
      sessions.delete(currentSession.sessionId);
    }
  });
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[mock-transcriber] shutting down...");
  wss.close(() => {
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  wss.close(() => {
    process.exit(0);
  });
});
