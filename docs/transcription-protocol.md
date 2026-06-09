# Transcription Protocol

The extension communicates with the local Kotomi Transcriber over WebSocket.

## Message Flow

```
Extension                    Transcriber
   │                             │
   │─── session.start ──────────▶│
   │                             │
   │─── audio.chunk ────────────▶│
   │─── audio.chunk ────────────▶│
   │─── audio.chunk ────────────▶│
   │                             │
   │◀── transcript.segment ──────│
   │◀── transcript.segment ──────│
   │◀── transcript.segment ──────│
   │                             │
   │─── session.end ────────────▶│
```

## Message Types

```typescript
type CaptureSource = "tab_audio" | "microphone";

interface TranscriptSessionStart {
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

interface AudioChunkMessage {
  type: "audio.chunk";
  sessionId: string;
  chunkIndex: number;
  mimeType: "audio/webm;codecs=opus";
  timestampMs: number;
}

interface TranscriptSegment {
  type: "transcript.segment";
  sessionId: string;
  segmentId: string;
  startMs: number;
  endMs: number;
  text: string;
  isFinal: boolean;
  confidence?: number;
}
```
