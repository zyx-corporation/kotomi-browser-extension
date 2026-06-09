import type {
  TranscriptSessionStart,
  AudioChunkMessage,
  TranscriptSegment,
} from "./types";

export type ExtensionMessage =
  | TranscriptSessionStart
  | AudioChunkMessage
  | TranscriptSegment
  | SessionEndMessage;

export interface SessionEndMessage {
  type: "session.end";
  sessionId: string;
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
