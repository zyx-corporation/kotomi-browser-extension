// Markdown export — serializes a transcript session to human-readable Markdown.
// Designed as a pure function: no side effects, no DOM access.

import type { TranscriptSession, StoredSegment } from "./transcript";

export interface MarkdownExportOptions {
  /** Include interim (non-final) segments. Default: false. */
  includeInterim?: boolean;
}

export function exportMarkdown(
  session: TranscriptSession,
  options: MarkdownExportOptions = {},
): string {
  const { includeInterim = false } = options;
  const lines: string[] = [];

  // --- Header ---
  lines.push("# Kotomi Transcript");
  lines.push("");

  // --- Metadata block ---
  lines.push("## Metadata");
  lines.push("");
  lines.push(`- **Session ID**: \`${session.sessionId}\``);
  if (session.metadata.title) {
    lines.push(`- **Title**: ${session.metadata.title}`);
  }
  if (session.metadata.url) {
    lines.push(`- **URL**: ${session.metadata.url}`);
  }
  lines.push(`- **Source**: ${session.metadata.source}`);
  lines.push(`- **Capture Mode**: ${session.metadata.captureMode}`);
  if (session.metadata.transcriberState) {
    lines.push(`- **Transcriber**: ${session.metadata.transcriberState}`);
  }
  lines.push(`- **Started**: ${formatISODate(session.metadata.startedAt)}`);
  if (session.metadata.endedAt) {
    lines.push(`- **Ended**: ${formatISODate(session.metadata.endedAt)}`);
  }
  lines.push(`- **Exported**: ${formatISODate(session.metadata.exportedAt ?? Date.now())}`);
  lines.push("");

  // --- Segment count ---
  const segments = includeInterim
    ? session.segments
    : session.segments.filter((s) => s.isFinal);

  lines.push(`- **Segments**: ${segments.length} (${session.segments.length - segments.length} interim excluded)`);
  lines.push("");

  // --- Transcript body ---
  lines.push("## Transcript");
  lines.push("");

  if (segments.length === 0) {
    lines.push("_(no transcript segments)_");
    lines.push("");
  } else {
    for (const seg of segments) {
      lines.push(formatSegmentLine(seg));
    }
  }

  return lines.join("\n");
}

// --- Internals ---

function formatISODate(ts: number): string {
  return new Date(ts).toISOString();
}

function formatTimestamp(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hours = Math.floor(min / 60);
  const remainingMin = min % 60;
  const remainingSec = sec % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(remainingMin).padStart(2, "0")}:${String(remainingSec).padStart(2, "0")}`;
  }
  return `${String(remainingMin).padStart(2, "0")}:${String(remainingSec).padStart(2, "0")}`;
}

function formatSegmentLine(seg: StoredSegment): string {
  const time = `[${formatTimestamp(seg.startMs)}-${formatTimestamp(seg.endMs)}]`;
  const speaker = seg.speaker ? ` **${seg.speaker}:**` : "";
  const conf = seg.confidence != null ? ` *(conf: ${(seg.confidence * 100).toFixed(0)}%)*` : "";
  return `${time}${speaker} ${seg.text}${conf}\n`;
}
