// JSON export — serializes a transcript session to JSON.

import type { TranscriptSession } from "./transcript";

export function exportJSON(session: TranscriptSession): string {
  return JSON.stringify(session, null, 2);
}
