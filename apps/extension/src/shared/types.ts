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

// --- WebSocket protocol messages (extension ↔ Kotomi transcriber) ---

export type TranscriberProtocolMessage =
  | TranscriptionSessionStartMessage
  | TranscriptionAudioChunkMessage
  | TranscriptionSessionStopMessage
  | TranscriptSegmentMessage
  | TranscriberErrorMessage
  | TranscriberStateMessage;

export interface TranscriptionSessionStartMessage {
  type: "transcription.session.start";
  sessionId: string;
  source: {
    type: "tab_audio";
    url?: string;
    title?: string;
  };
  audio: {
    mimeType: "audio/webm;codecs=opus";
    timesliceMs: number;
  };
  options: {
    language: "ja" | "en" | "auto";
    interim: boolean;
  };
}

export interface TranscriptionAudioChunkMessage {
  type: "transcription.audio.chunk";
  sessionId: string;
  chunkIndex: number;
  timestampMs: number;
  mimeType: "audio/webm;codecs=opus";
}

export interface TranscriptionSessionStopMessage {
  type: "transcription.session.stop";
  sessionId: string;
  reason: "user_stop" | "error" | "capture_ended";
}

export interface TranscriptSegmentMessage {
  type: "transcript.segment";
  sessionId: string;
  segmentId: string;
  startMs: number;
  endMs: number;
  text: string;
  isFinal: boolean;
  confidence?: number;
  speaker?: string | null;
}

export interface TranscriberErrorMessage {
  type: "transcriber.error";
  sessionId?: string;
  message: string;
  detail?: unknown;
}

export interface TranscriberStateMessage {
  type: "transcriber.state";
  status: "disconnected" | "connecting" | "connected" | "error";
  sessionId?: string;
  message?: string;
}

// --- Internal transcript relay message (offscreen → service worker → side panel) ---

export interface TranscriptSegmentRelayMessage {
  type: "transcript.segment.relay";
  segment: TranscriptSegmentMessage;
}

// --- Legacy internal types (kept for backward compatibility) ---

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
