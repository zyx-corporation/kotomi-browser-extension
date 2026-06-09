// Markdown export — serializes a transcript session to Markdown.

import type { TranscriptSession } from "./transcript";

export function exportMarkdown(session: TranscriptSession): string {
  const lines: string[] = [];

  lines.push(`# Transcript`);
  lines.push("");
  lines.push(`- **Source**: ${session.metadata.url ?? "unknown"}`);
  lines.push(`- **Title**: ${session.metadata.title ?? "untitled"}`);
  lines.push(`- **Started**: ${new Date(session.metadata.startedAt).toISOString()}`);
  lines.push("");

  for (const segment of session.segments) {
    lines.push(segment.text);
    lines.push("");
  }

  return lines.join("\n");
}
