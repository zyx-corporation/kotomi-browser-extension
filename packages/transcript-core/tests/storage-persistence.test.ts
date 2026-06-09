// Tests for transcript-core storage persistence (serialize / deserialize).
// Pure function tests — no Chrome API dependency.
//
// Usage: npx tsx packages/transcript-core/tests/storage-persistence.test.ts

import {
  serializeSession,
  deserializeSession,
  isValidPersistedSession,
  STORAGE_SCHEMA_VERSION,
  type PersistedSession,
} from "../src/storage";
import {
  createTranscriptSession,
  upsertSegment,
  type TranscriptSession,
  type StoredSegment,
} from "../src/transcript";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function makeSegment(overrides: Partial<StoredSegment> = {}): StoredSegment {
  return {
    segmentId: "seg-0001",
    startMs: 0,
    endMs: 3000,
    text: "テスト",
    isFinal: true,
    confidence: 0.95,
    speaker: null,
    receivedAt: Date.now(),
    ...overrides,
  };
}

function makeSession(segments: StoredSegment[] = []): TranscriptSession {
  const session = createTranscriptSession("sess-persist-1", {
    startedAt: 1700000000000,
    title: "Persistence Test",
    url: "https://example.com",
    transcriberState: "connected",
    endedAt: 1700000100000,
  });
  session.segments.push(...segments);
  return session;
}

// --- Serialize ---

console.log("\nSerialize:");
test("serializeSession produces valid schemaVersion", () => {
  const session = makeSession();
  const persisted = serializeSession(session);
  assert(persisted.schemaVersion === STORAGE_SCHEMA_VERSION, "schemaVersion matches");
});

test("serializeSession preserves sessionId", () => {
  const session = makeSession();
  const persisted = serializeSession(session);
  assert(persisted.sessionId === "sess-persist-1", "sessionId preserved");
});

test("serializeSession preserves metadata fields", () => {
  const session = makeSession();
  const persisted = serializeSession(session);
  assert(persisted.metadata.title === "Persistence Test", "title");
  assert(persisted.metadata.url === "https://example.com", "url");
  assert(persisted.metadata.startedAt === 1700000000000, "startedAt");
  assert(persisted.metadata.endedAt === 1700000100000, "endedAt");
  assert(persisted.metadata.captureMode === "tab_audio", "captureMode");
  assert(persisted.metadata.transcriberState === "connected", "transcriberState");
});

test("serializeSession sets updatedAt to current time", () => {
  const before = Date.now();
  const session = makeSession();
  const persisted = serializeSession(session);
  const after = Date.now();
  assert(persisted.updatedAt >= before && persisted.updatedAt <= after, "updatedAt is current");
});

test("serializeSession includes all segments", () => {
  const seg1 = makeSegment({ segmentId: "seg-1", text: "A" });
  const seg2 = makeSegment({ segmentId: "seg-2", text: "B" });
  const session = makeSession([seg1, seg2]);
  const persisted = serializeSession(session);
  assert(persisted.segments.length === 2, "2 segments");
  assert(persisted.segments[0].text === "A", "first segment text");
  assert(persisted.segments[1].text === "B", "second segment text");
});

test("serializeSession with custom createdAt", () => {
  const session = makeSession();
  const persisted = serializeSession(session, 1718000000000);
  assert(persisted.createdAt === 1718000000000, "custom createdAt");
});

// --- Deserialize ---

console.log("\nDeserialize:");
test("deserializeSession returns equivalent session", () => {
  const seg = makeSegment({ segmentId: "seg-x", text: "復元テスト" });
  const original = makeSession([seg]);
  const persisted = serializeSession(original);
  const restored = deserializeSession(persisted);
  assert(restored.sessionId === original.sessionId, "sessionId match");
  assert(restored.metadata.title === original.metadata.title, "title match");
  assert(restored.segments.length === 1, "segment count match");
  assert(restored.segments[0].text === "復元テスト", "segment text match");
  assert(restored.segments[0].segmentId === "seg-x", "segmentId match");
});

test("deserializeSession preserves confidence and speaker", () => {
  const seg = makeSegment({ segmentId: "seg-c", confidence: 0.88, speaker: "田中" });
  const session = makeSession([seg]);
  const persisted = serializeSession(session);
  const restored = deserializeSession(persisted);
  assert(restored.segments[0].confidence === 0.88, "confidence");
  assert(restored.segments[0].speaker === "田中", "speaker");
});

test("deserializeSession yields exportable session", () => {
  const seg = makeSegment({ segmentId: "seg-e", text: "Export可能" });
  const session = makeSession([seg]);
  const persisted = serializeSession(session);
  const restored = deserializeSession(persisted);

  // Should be exportable (import dynamically to test integration)
  const { exportMarkdown } = require("../src/export-markdown");
  const md = exportMarkdown(restored);
  assert(md.includes("Export可能"), "restored session produces valid markdown");
});

// --- Validate ---

console.log("\nValidate:");
test("isValidPersistedSession accepts valid data", () => {
  const session = makeSession();
  const persisted = serializeSession(session);
  assert(isValidPersistedSession(persisted), "valid data accepted");
});

test("isValidPersistedSession rejects null", () => {
  assert(!isValidPersistedSession(null), "null rejected");
});

test("isValidPersistedSession rejects wrong schemaVersion", () => {
  const session = makeSession();
  const persisted = serializeSession(session);
  persisted.schemaVersion = "999.0.0";
  assert(!isValidPersistedSession(persisted), "wrong version rejected");
});

test("isValidPersistedSession rejects missing sessionId", () => {
  const data = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    createdAt: Date.now(),
    segments: [],
  };
  assert(!isValidPersistedSession(data), "missing sessionId rejected");
});

test("isValidPersistedSession rejects missing segments array", () => {
  const data = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    sessionId: "test",
    createdAt: Date.now(),
  };
  assert(!isValidPersistedSession(data), "missing segments rejected");
});

// --- upsertSegment persistence ---

console.log("\nupsertSegment + persistence:");
test("serialize after upsert reflects update", () => {
  const session = makeSession([makeSegment({ segmentId: "seg-u", text: "初回", isFinal: false })]);
  const updated = upsertSegment(session, makeSegment({ segmentId: "seg-u", text: "更新", isFinal: true }));
  const persisted = serializeSession(updated);
  assert(persisted.segments.length === 1, "still 1 segment");
  assert(persisted.segments[0].text === "更新", "text updated");
  assert(persisted.segments[0].isFinal === true, "isFinal updated");
});

// --- Summary ---

console.log(`\n───────────────`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

if (failed > 0) {
  console.log("\nFAILED");
  process.exit(1);
} else {
  console.log("\nAll tests passed ✓");
  process.exit(0);
}
