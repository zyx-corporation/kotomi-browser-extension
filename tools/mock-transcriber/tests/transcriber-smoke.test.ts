// Smoke test for the mock Kotomi transcriber WebSocket server.
// Verifies: connect → session.start → audio chunks → transcript.segment → session.stop → disconnect
//
// Usage: npx tsx tools/mock-transcriber/tests/transcriber-smoke.test.ts

import WebSocket from "ws";

const WS_URL = "ws://127.0.0.1:8765/v1/transcribe/stream";
const SESSION_ID = "smoke-test-" + Date.now();

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
  console.log("Kotomi Mock Transcriber — Smoke Test\n");

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
    console.log("\n  Make sure mock transcriber is running: cd tools/mock-transcriber && npm start");
    return;
  }

  // --- 2. Send session.start ---
  console.log("\n2. Session start");
  let segmentCount = 0;
  const segments: unknown[] = [];

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data.toString());
      if (msg.type === "transcript.segment") {
        segmentCount++;
        segments.push(msg);
        console.log(`  ← transcript.segment: "${msg.text}"`);
      } else if (msg.type === "transcriber.state") {
        console.log(`  ← transcriber.state: ${msg.status}`);
      }
    } catch {
      // binary frame — ignore
    }
  };

  ws.send(JSON.stringify({
    type: "transcription.session.start",
    sessionId: SESSION_ID,
    source: { type: "tab_audio", url: "https://example.com", title: "Smoke Test" },
    audio: { mimeType: "audio/webm;codecs=opus", timesliceMs: 1000 },
    options: { language: "ja", interim: true },
  }));
  record("Send session.start", true, SESSION_ID);

  await sleep(300);

  // --- 3. Send audio chunks (JSON + binary) ---
  console.log("\n3. Audio chunks");
  const fakeAudio = Buffer.alloc(1024, 0xAA); // 1KB dummy audio

  for (let i = 0; i < 6; i++) {
    // Send JSON metadata
    ws.send(JSON.stringify({
      type: "transcription.audio.chunk",
      sessionId: SESSION_ID,
      chunkIndex: i,
      timestampMs: Date.now(),
      mimeType: "audio/webm;codecs=opus",
    }));

    // Send binary audio frame
    ws.send(fakeAudio);

    console.log(`  → chunk #${i} (JSON + 1024 bytes binary)`);
    await sleep(200); // give server time to respond
  }

  record("Send 6 audio chunks", true, "6 JSON + 6 binary frames");

  // --- 4. Verify segments ---
  console.log("\n4. Segment verification");
  await sleep(500); // wait for final segment

  // 6 chunks / 3 = 2 segments expected
  if (segmentCount >= 2) {
    record("Receive transcript segments", true, `${segmentCount} segments received (expected ≥2)`);
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
