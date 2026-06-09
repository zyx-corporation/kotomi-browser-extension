export type CaptureSource = "tab_audio" | "microphone";

// --- Capture control messages (popup ↔ service worker) ---

export interface StartCaptureMessage {
  type: "capture.start";
}

export interface StopCaptureMessage {
  type: "capture.stop";
}

// --- Capture state messages (service worker → popup / side panel) ---

export type CaptureStatus = "idle" | "capturing" | "error";

export interface CaptureStateMessage {
  type: "capture.state";
  status: CaptureStatus;
  sessionId?: string;
  error?: string;
}

// --- Audio chunk metadata (offscreen → service worker → side panel) ---

export interface AudioChunkMetadataMessage {
  type: "audio.chunk.metadata";
  sessionId: string;
  chunkIndex: number;
  sizeBytes: number;
  timestampMs: number;
}

// --- Transcription protocol messages (for later: extension ↔ transcriber) ---

export interface TranscriptSessionStart {
  type: "session.start";
  sessionId: string;
  source: {
    type: CaptureSource;
    url?: string;
    title?: string;
  };
  options: {
    language?: "ja" | "en" | "auto";
    interim: boolean;
  };
}

export interface AudioChunkMessage {
  type: "audio.chunk";
  sessionId: string;
  chunkIndex: number;
  mimeType: "audio/webm;codecs=opus";
  timestampMs: number;
}

export interface TranscriptSegment {
  type: "transcript.segment";
  sessionId: string;
  segmentId: string;
  startMs: number;
  endMs: number;
  text: string;
  isFinal: boolean;
  confidence?: number;
}
