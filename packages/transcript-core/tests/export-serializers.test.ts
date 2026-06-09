// Tests for transcript-core serializers (Markdown and JSON export).
// Pure function tests — no DOM, no Chrome APIs.
//
// Usage: npx tsx packages/transcript-core/tests/export-serializers.test.ts

import {
  createTranscriptSession,
  upsertSegment,
  finalOnly,
  type TranscriptSession,
  type StoredSegment,
} from "../src/transcript";
import { exportMarkdown } from "../src/export-markdown";
import { exportJSON } from "../src/export-json";

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
    text: "これはテストです。",
    isFinal: true,
    confidence: 0.95,
    speaker: null,
    receivedAt: Date.now(),
    ...overrides,
  };
}

function makeSession(segments: StoredSegment[] = []): TranscriptSession {
  const session = createTranscriptSession("test-session-123", {
    startedAt: 1700000000000,
    title: "Test Page",
    url: "https://example.com",
    transcriberState: "connected",
    endedAt: 1700000030000,
  });
  session.segments.push(...segments);
  return session;
}

// --- Markdown tests ---

console.log("\nMarkdown Export:");
test("empty session produces header and metadata", () => {
  const session = makeSession([]);
  const md = exportMarkdown(session);
  assert(md.includes("# Kotomi Transcript"), "has header");
  assert(md.includes("**Session ID**: `test-session-123`"), "has session ID");
  assert(md.includes("**Title**: Test Page"), "has title");
  assert(md.includes("**URL**: https://example.com"), "has URL");
  assert(md.includes("_(no transcript segments)_"), "shows empty message");
});

test("includes segment with timestamp", () => {
  const seg = makeSegment({ startMs: 1500, endMs: 4500, text: "こんにちは" });
  const session = makeSession([seg]);
  const md = exportMarkdown(session);
  assert(md.includes("[00:01-00:04] こんにちは"), "has timestamp and text");
});

test("includes confidence annotation", () => {
  const seg = makeSegment({ confidence: 0.88 });
  const session = makeSession([seg]);
  const md = exportMarkdown(session);
  assert(md.includes("(conf: 88%)"), "has confidence");
});

test("includes speaker label", () => {
  const seg = makeSegment({ speaker: "Speaker A" });
  const session = makeSession([seg]);
  const md = exportMarkdown(session);
  assert(md.includes("**Speaker A:**"), "has speaker label");
});

test("excludes interim segments by default", () => {
  const final = makeSegment({ segmentId: "seg-1", isFinal: true, text: "最終" });
  const interim = makeSegment({ segmentId: "seg-2", isFinal: false, text: "中間" });
  const session = makeSession([final, interim]);
  const md = exportMarkdown(session);
  assert(md.includes("最終"), "has final segment");
  assert(!md.includes("中間"), "interim excluded by default");
  assert(md.includes("1 interim excluded"), "has interim count");
});

test("includes interim segments when option set", () => {
  const final = makeSegment({ segmentId: "seg-1", isFinal: true, text: "最終" });
  const interim = makeSegment({ segmentId: "seg-2", isFinal: false, text: "中間" });
  const session = makeSession([final, interim]);
  const md = exportMarkdown(session, { includeInterim: true });
  assert(md.includes("最終"), "has final");
  assert(md.includes("中間"), "has interim");
});

test("long timestamp includes hours", () => {
  const seg = makeSegment({ startMs: 3723000, endMs: 3728000, text: "長時間" });
  const session = makeSession([seg]);
  const md = exportMarkdown(session);
  assert(md.includes("[01:02:03-01:02:08]"), "has hour-prefixed timestamp");
});

// --- JSON tests ---

console.log("\nJSON Export:");
test("empty session produces valid JSON schema", () => {
  const session = makeSession([]);
  const json = exportJSON(session);
  const parsed = JSON.parse(json);
  assert(parsed.schemaVersion === "0.1.0", "has schemaVersion");
  assert(parsed.session.sessionId === "test-session-123", "has sessionId");
  assert(parsed.session.segmentCount === 0, "segmentCount is 0");
  assert(parsed.session.finalSegmentCount === 0, "finalSegmentCount is 0");
  assert(Array.isArray(parsed.segments), "segments is array");
  assert(parsed.segments.length === 0, "segments empty");
});

test("preserves all segment fields", () => {
  const seg = makeSegment({
    segmentId: "seg-0042",
    startMs: 2000,
    endMs: 5000,
    text: "JSONテスト",
    isFinal: true,
    confidence: 0.99,
    speaker: "田中",
    receivedAt: 1718100000000,
  });
  const session = makeSession([seg]);
  const json = exportJSON(session);
  const parsed = JSON.parse(json);
  const s = parsed.segments[0];
  assert(s.segmentId === "seg-0042", "segmentId");
  assert(s.startMs === 2000, "startMs");
  assert(s.endMs === 5000, "endMs");
  assert(s.text === "JSONテスト", "text");
  assert(s.isFinal === true, "isFinal");
  assert(s.confidence === 0.99, "confidence");
  assert(s.speaker === "田中", "speaker");
  assert(typeof s.receivedAt === "string", "receivedAt is ISO string");
});

test("excludes interim segments by default", () => {
  const final = makeSegment({ segmentId: "seg-1", isFinal: true, text: "最終" });
  const interim = makeSegment({ segmentId: "seg-2", isFinal: false, text: "中間" });
  const session = makeSession([final, interim]);
  const json = exportJSON(session);
  const parsed = JSON.parse(json);
  assert(parsed.segments.length === 1, "only final segments");
  assert(parsed.session.finalSegmentCount === 1, "finalSegmentCount correct");
  assert(parsed.session.segmentCount === 2, "total segmentCount correct");
});

test("pretty option controls indentation", () => {
  const session = makeSession([makeSegment()]);
  const pretty = exportJSON(session, { pretty: true });
  const compact = exportJSON(session, { pretty: false });
  assert(pretty.includes("\n  "), "pretty has newlines+indent");
  assert(!compact.includes("\n  "), "compact has no indent");
});

// --- Model tests ---

console.log("\nTranscript Model:");
test("upsertSegment replaces existing segmentId", () => {
  const session = makeSession([
    makeSegment({ segmentId: "seg-1", text: "初回", isFinal: false }),
  ]);
  const updated = upsertSegment(session, makeSegment({ segmentId: "seg-1", text: "更新", isFinal: true }));
  assert(updated.segments.length === 1, "still one segment");
  assert(updated.segments[0].text === "更新", "text updated");
  assert(updated.segments[0].isFinal === true, "isFinal updated");
});

test("upsertSegment adds new segmentId", () => {
  const session = makeSession([makeSegment({ segmentId: "seg-1" })]);
  const updated = upsertSegment(session, makeSegment({ segmentId: "seg-2" }));
  assert(updated.segments.length === 2, "two segments");
});

test("finalOnly filters interim", () => {
  const session = makeSession([
    makeSegment({ segmentId: "seg-1", isFinal: true }),
    makeSegment({ segmentId: "seg-2", isFinal: false }),
    makeSegment({ segmentId: "seg-3", isFinal: true }),
  ]);
  const result = finalOnly(session);
  assert(result.segments.length === 2, "only finals");
  assert(result.segments.every((s) => s.isFinal), "all are final");
});

// --- Edge cases ---

console.log("\nEdge Cases:");
test("zero-duration segment", () => {
  const seg = makeSegment({ startMs: 0, endMs: 0 });
  const session = makeSession([seg]);
  const md = exportMarkdown(session);
  assert(md.includes("[00:00-00:00]"), "zero timestamps rendered");
});

test("missing confidence omitted", () => {
  const seg = makeSegment({ confidence: undefined });
  const session = makeSession([seg]);
  const md = exportMarkdown(session);
  assert(!md.includes("conf:"), "no confidence annotation");
});

test("speaker null omitted", () => {
  const seg = makeSegment({ speaker: null });
  const session = makeSession([seg]);
  const md = exportMarkdown(session);
  // The transcript section should NOT contain a speaker label like "**Speaker:**"
  const transcriptSection = md.split("## Transcript\n")[1] ?? "";
  assert(!transcriptSection.includes(":**"), "no speaker label in transcript section");
});

test("segment text with special Markdown chars", () => {
  const seg = makeSegment({ text: "*強調* と #見出し と [リンク](url)" });
  const session = makeSession([seg]);
  const md = exportMarkdown(session);
  // Text is preserved as-is (no escaping needed in this context)
  assert(md.includes("*強調*"), "asterisks preserved");
  assert(md.includes("#見出し"), "hash preserved");
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
