// Smoke test for the real Kotomi transcriber (mock backend).
// Verifies the same protocol as mock-transcriber but through the adapter architecture.
//
// Usage: npx tsx tools/real-transcriber/tests/real-transcriber-smoke.test.ts

import WebSocket from "ws";

const WS_URL = "ws://127.0.0.1:8765/v1/transcribe/stream";
const SESSION_ID = "smoke-real-" + Date.now();

interface TestResult {
  name: string;
  passed: boolean;
  detail?: string;
}

const results: TestResult[] = [];
let ws: WebSocket | null = null;

function record(name: string, passed: boolean, detail?: string): void {
  results.push({ name, passed, detail });
  const icon = passed ? "✓" : "✗";
  console.log(`  ${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSmoke(): Promise<void> {
  console.log("Kotomi Real Transcriber — Smoke Test (mock backend)\n");

  // --- 1. Connect ---
  console.log("1. Connection");
  try {
    ws = new WebSocket(WS_URL);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("connection timeout")), 5000);
      ws!.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };
      ws!.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
    });
    record("WebSocket connect", true, WS_URL);
  } catch (err) {
    record("WebSocket connect", false, String(err));
    console.log("\n  Make sure real transcriber is running:");
    console.log("    cd tools/real-transcriber && npm run start:mock");
    return;
  }

  // --- 2. Send session.start ---
  console.log("\n2. Session start");
  let segmentCount = 0;
  let stateReceived = false;
  let errorReceived = false;

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data.toString());
      if (msg.type === "transcript.segment") {
        segmentCount++;
        console.log(`  ← transcript.segment: "${msg.text}" (confidence: ${msg.confidence})`);
      } else if (msg.type === "transcriber.state") {
        stateReceived = true;
        console.log(`  ← transcriber.state: ${msg.status}`);
      } else if (msg.type === "transcriber.error") {
        errorReceived = true;
        console.log(`  ← transcriber.error: ${msg.message}`);
      }
    } catch {
      // binary frame — ignore
    }
  };

  ws.send(JSON.stringify({
    type: "transcription.session.start",
    sessionId: SESSION_ID,
    source: { type: "tab_audio", url: "https://example.com", title: "Real Transcriber Smoke" },
    audio: { mimeType: "audio/webm;codecs=opus", timesliceMs: 1000 },
    options: { language: "ja", interim: true },
  }));
  record("Send session.start", true, SESSION_ID);

  await sleep(300);
  record("Receive transcriber.state", stateReceived, stateReceived ? "received" : "not received");

  // --- 3. Send audio chunks (JSON + binary) ---
  console.log("\n3. Audio chunks");
  const fakeAudio = Buffer.alloc(1024, 0xBB);

  for (let i = 0; i < 6; i++) {
    ws.send(JSON.stringify({
      type: "transcription.audio.chunk",
      sessionId: SESSION_ID,
      chunkIndex: i,
      timestampMs: Date.now(),
      mimeType: "audio/webm;codecs=opus",
    }));
    ws.send(fakeAudio);
    console.log(`  → chunk #${i}`);
    await sleep(300);
  }

  record("Send 6 audio chunks", true, "6 JSON + 6 binary frames");

  // --- 4. Verify segments ---
  console.log("\n4. Segment verification");
  await sleep(800);

  // With CHUNKS_PER_SEGMENT=3, 6 chunks = 2 segments
  if (segmentCount >= 2) {
    record("Receive transcript segments", true, `${segmentCount} segments (expected ≥2)`);
  } else {
    record("Receive transcript segments", false, `only ${segmentCount} segments (expected ≥2)`);
  }

  // --- 5. Send session.stop ---
  console.log("\n5. Session stop");
  ws.send(JSON.stringify({
    type: "transcription.session.stop",
    sessionId: SESSION_ID,
    reason: "user_stop",
  }));
  record("Send session.stop", true, "reason: user_stop");

  await sleep(200);

  // --- 6. Close ---
  ws.close();
  ws = null;
  record("WebSocket disconnect", true);

  // --- 7. Error handling (transcriber unreachable) ---
  console.log("\n6. Error handling (mock backend always succeeds, skip)");
  record("transcriber.error not raised on valid connection", !errorReceived, errorReceived ? "unexpected error" : "no error");

  // --- Summary ---
  console.log("\n───────────────");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Results: ${passed} passed, ${failed} failed, ${results.length} total`);

  if (failed > 0) {
    console.log("\nFAILED:");
    for (const r of results) {
      if (!r.passed) console.log(`  ✗ ${r.name}: ${r.detail ?? ""}`);
    }
    process.exit(1);
  } else {
    console.log("\nAll smoke tests passed ✓");
    process.exit(0);
  }
}

runSmoke();
