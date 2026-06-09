export type CaptureSource = "tab_audio" | "microphone";

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
