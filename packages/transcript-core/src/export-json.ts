// JSON export — serializes a transcript session to machine-readable JSON.
// Preserves all segment fields for downstream processing (audit, RDE, summarization).

import type { TranscriptSession, StoredSegment } from "./transcript";

const SCHEMA_VERSION = "0.1.0";

export interface JSONExportOptions {
  /** Include interim (non-final) segments. Default: false. */
  includeInterim?: boolean;
  /** Pretty-print with indentation. Default: true. */
  pretty?: boolean;
}

export interface JSONExportSchema {
  schemaVersion: string;
  exportedAt: string;
  session: {
    sessionId: string;
    source: string;
    url?: string;
    title?: string;
    captureMode: string;
    transcriberState?: string;
    startedAt: string;
    endedAt?: string;
    segmentCount: number;
    finalSegmentCount: number;
  };
  segments: JSONExportSegment[];
}

export interface JSONExportSegment {
  segmentId: string;
  startMs: number;
  endMs: number;
  text: string;
  isFinal: boolean;
  confidence?: number;
  speaker?: string | null;
  receivedAt: string;
}

export function exportJSON(
  session: TranscriptSession,
  options: JSONExportOptions = {},
): string {
  const { includeInterim = false, pretty = true } = options;

  const segments = includeInterim
    ? session.segments
    : session.segments.filter((s) => s.isFinal);

  const schema: JSONExportSchema = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(session.metadata.exportedAt ?? Date.now()).toISOString(),
    session: {
      sessionId: session.sessionId,
      source: session.metadata.source,
      url: session.metadata.url,
      title: session.metadata.title,
      captureMode: session.metadata.captureMode,
      transcriberState: session.metadata.transcriberState,
      startedAt: new Date(session.metadata.startedAt).toISOString(),
      endedAt: session.metadata.endedAt
        ? new Date(session.metadata.endedAt).toISOString()
        : undefined,
      segmentCount: session.segments.length,
      finalSegmentCount: session.segments.filter((s) => s.isFinal).length,
    },
    segments: segments.map(toJSONSegment),
  };

  return JSON.stringify(schema, null, pretty ? 2 : 0);
}

function toJSONSegment(seg: StoredSegment): JSONExportSegment {
  return {
    segmentId: seg.segmentId,
    startMs: seg.startMs,
    endMs: seg.endMs,
    text: seg.text,
    isFinal: seg.isFinal,
    confidence: seg.confidence,
    speaker: seg.speaker ?? null,
    receivedAt: new Date(seg.receivedAt).toISOString(),
  };
}
