// Transcript model — core data structure for a transcript session.

export interface TranscriptSession {
  sessionId: string;
  segments: TranscriptSegment[];
  metadata: {
    url?: string;
    title?: string;
    startedAt: number;
    endedAt?: number;
    captureMode: "tab_audio" | "microphone";
  };
}

export interface TranscriptSegment {
  segmentId: string;
  startMs: number;
  endMs: number;
  text: string;
  isFinal: boolean;
  confidence?: number;
}

export function createTranscriptSession(
  sessionId: string,
  metadata: TranscriptSession["metadata"],
): TranscriptSession {
  return {
    sessionId,
    segments: [],
    metadata,
  };
}

export function addSegment(
  session: TranscriptSession,
  segment: TranscriptSegment,
): TranscriptSession {
  return {
    ...session,
    segments: [...session.segments, segment],
  };
}
