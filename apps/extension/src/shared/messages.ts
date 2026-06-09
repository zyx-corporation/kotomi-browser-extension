import type {
  StartCaptureMessage,
  StopCaptureMessage,
  CaptureStateMessage,
  AudioChunkMetadataMessage,
  TranscriptSessionStart,
  AudioChunkMessage,
  TranscriptSegment,
} from "./types";

export type ExtensionMessage =
  | StartCaptureMessage
  | StopCaptureMessage
  | CaptureStateMessage
  | AudioChunkMetadataMessage
  | TranscriptSessionStart
  | AudioChunkMessage
  | TranscriptSegment
  | SessionEndMessage;

export interface SessionEndMessage {
  type: "session.end";
  sessionId: string;
}

// --- Factory functions ---

export function createStartCapture(): StartCaptureMessage {
  return { type: "capture.start" };
}

export function createStopCapture(): StopCaptureMessage {
  return { type: "capture.stop" };
}

export function createCaptureState(
  status: CaptureStateMessage["status"],
  sessionId?: string,
  error?: string,
): CaptureStateMessage {
  return { type: "capture.state", status, sessionId, error };
}

export function createAudioChunkMetadata(
  sessionId: string,
  chunkIndex: number,
  sizeBytes: number,
  timestampMs: number,
): AudioChunkMetadataMessage {
  return {
    type: "audio.chunk.metadata",
    sessionId,
    chunkIndex,
    sizeBytes,
    timestampMs,
  };
}

export function createSessionStart(
  sessionId: string,
  source: { type: "tab_audio" | "microphone"; url?: string; title?: string },
  options: { language?: "ja" | "en" | "auto"; interim: boolean },
): TranscriptSessionStart {
  return {
    type: "session.start",
    sessionId,
    source,
    options,
  };
}

export function createAudioChunk(
  sessionId: string,
  chunkIndex: number,
  timestampMs: number,
): AudioChunkMessage {
  return {
    type: "audio.chunk",
    sessionId,
    chunkIndex,
    mimeType: "audio/webm;codecs=opus",
    timestampMs,
  };
}

export function createSessionEnd(sessionId: string): SessionEndMessage {
  return {
    type: "session.end",
    sessionId,
  };
}
