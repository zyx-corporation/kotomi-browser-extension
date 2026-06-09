// Transcript model — core data structure for a transcript session.
// Contains the minimum fields needed for serialization, storage, and audit.

export interface TranscriptSession {
  sessionId: string;
  segments: StoredSegment[];
  metadata: TranscriptMetadata;
}

export interface TranscriptMetadata {
  url?: string;
  title?: string;
  startedAt: number;
  endedAt?: number;
  exportedAt?: number;
  captureMode: "tab_audio" | "microphone";
  transcriberState?: string;
  source: string;
}

export interface StoredSegment {
  segmentId: string;
  startMs: number;
  endMs: number;
  text: string;
  isFinal: boolean;
  confidence?: number;
  speaker?: string | null;
  receivedAt: number;
}

// --- Factory functions ---

export function createTranscriptSession(
  sessionId: string,
  metadata: Partial<TranscriptMetadata> & Pick<TranscriptMetadata, "startedAt">,
): TranscriptSession {
  return {
    sessionId,
    segments: [],
    metadata: {
      source: "Kotomi Browser Extension v0.1.0",
      captureMode: "tab_audio",
      ...metadata,
    },
  };
}

export function upsertSegment(
  session: TranscriptSession,
  segment: StoredSegment,
): TranscriptSession {
  // Replace existing segment with same segmentId (handles interim→final transition)
  const existing = session.segments.findIndex((s) => s.segmentId === segment.segmentId);

  if (existing >= 0) {
    const updated = [...session.segments];
    updated[existing] = segment;
    return { ...session, segments: updated };
  }

  return {
    ...session,
    segments: [...session.segments, segment],
  };
}

/** Filter to final-only segments (excludes interim). Returns a new session. */
export function finalOnly(session: TranscriptSession): TranscriptSession {
  return {
    ...session,
    segments: session.segments.filter((s) => s.isFinal),
  };
}
