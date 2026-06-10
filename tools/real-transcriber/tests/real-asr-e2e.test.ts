// Real ASR E2E test — sends actual audio through the WebSocket pipeline
// and verifies faster-whisper returns transcript.segment messages.
//
// Prerequisites:
//   1. Python ASR service: cd tools/real-transcriber/python && source .venv/bin/activate && python asr_service.py
//   2. Node server:        cd tools/real-transcriber && TRANSCRIBER_BACKEND=faster-whisper npx tsx src/server.ts
//   3. Test audio file:    /tmp/kotomi-test-speech.webm (generated with `say` + ffmpeg)
//
// Usage:
//   npx tsx tools/real-transcriber/tests/real-asr-e2e.test.ts

import WebSocket from "ws";
import { readFileSync, existsSync } from "fs";

const WS_URL = "ws://127.0.0.1:8765/v1/transcribe/stream";
const SESSION_ID = "e2e-real-" + Date.now();
const TEST_AUDIO_PATH = "/tmp/kotomi-test-speech.webm";

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

async function runE2E(): Promise<void> {
  console.log("Kotomi Real ASR — E2E Test (faster-whisper backend)\n");

  // --- 0. Check prerequisites ---
  console.log("0. Prerequisites");
  if (!existsSync(TEST_AUDIO_PATH)) {
    record("Test audio file exists", false, `${TEST_AUDIO_PATH} not found`);
    console.log("\n  Generate test audio with:");
    console.log("    say -o /tmp/test.aiff 'こんにちは、これはテストです。'");
    console.log("    ffmpeg -i /tmp/test.aiff -c:a libopus /tmp/kotomi-test-speech.webm");
    process.exit(1);
  }
  const audioData = readFileSync(TEST_AUDIO_PATH);
  record("Test audio file exists", true, `${TEST_AUDIO_PATH} (${audioData.length} bytes)`);

  // --- 1. Connect ---
  console.log("\n1. Connection");
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
    console.log("\n  Make sure both services are running:");
    console.log("    Terminal 1: cd tools/real-transcriber/python && source .venv/bin/activate && python asr_service.py");
    console.log("    Terminal 2: cd tools/real-transcriber && TRANSCRIBER_BACKEND=faster-whisper npx tsx src/server.ts");
    process.exit(1);
  }

  // --- 2. Send session.start ---
  console.log("\n2. Session start");
  let segments: Array<{ text: string; confidence: number }> = [];
  let stateReceived = false;
  let errorCount = 0;

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data.toString());
      if (msg.type === "transcript.segment") {
        segments.push({ text: msg.text, confidence: msg.confidence });
        console.log(`  ← transcript.segment: "${msg.text}" (confidence: ${msg.confidence})`);
      } else if (msg.type === "transcriber.state") {
        stateReceived = true;
        console.log(`  ← transcriber.state: ${msg.status}`);
      } else if (msg.type === "transcriber.error") {
        errorCount++;
        console.log(`  ← transcriber.error: ${msg.message}`);
      }
    } catch {
      // binary frame — ignore
    }
  };

  ws.send(JSON.stringify({
    type: "transcription.session.start",
    sessionId: SESSION_ID,
    source: { type: "tab_audio", url: "https://example.com", title: "Real ASR E2E" },
    audio: { mimeType: "audio/webm;codecs=opus", timesliceMs: 1000 },
    options: { language: "ja", interim: true },
  }));
  record("Send session.start", true, SESSION_ID);

  await sleep(300);
  record("Receive transcriber.state", stateReceived, stateReceived ? "received" : "not received");

  // --- 3. Send complete audio as a single chunk ---
  // We send the entire webm file as one chunk to ensure ffmpeg gets a valid input.
  // In production, Chrome MediaRecorder produces concatenable WebM fragments;
  // concatenating an entire capture session's chunks yields valid WebM.
  console.log("\n3. Audio chunk (complete WebM file)");

  ws.send(JSON.stringify({
    type: "transcription.audio.chunk",
    sessionId: SESSION_ID,
    chunkIndex: 0,
    timestampMs: Date.now(),
    mimeType: "audio/webm;codecs=opus",
  }));
  ws.send(audioData);
  console.log(`  → chunk #0 (${audioData.length} bytes — complete file)`);
  record("Send audio chunk", true, `${audioData.length} bytes`);

  // --- 4. Send session.stop (triggers batch processing) ---
  // The server accumulates all chunks and transcribes them at session.stop.
  console.log("\n4. Session stop");
  ws.send(JSON.stringify({
    type: "transcription.session.stop",
    sessionId: SESSION_ID,
    reason: "user_stop",
  }));
  record("Send session.stop", true, "reason: user_stop");

  // --- 5. Wait for transcription result ---
  console.log("\n5. Segment verification");
  // CPU inference takes a few seconds for ~2.25s of audio;
  // session.stop triggers batch processing of all accumulated chunks.
  await sleep(15000);

  if (errorCount > 0) {
    record("No transcriber errors", false, `${errorCount} errors`);
  } else {
    record("No transcriber errors", true, "no errors");
  }

  if (segments.length > 0) {
    const firstText = segments[0].text;
    const hasText = firstText.length > 0;
    record(
      "Receive transcript segments",
      hasText,
      `${segments.length} segments, first text: "${firstText}" (confidence: ${segments[0].confidence?.toFixed(4) ?? "N/A"})`,
    );
    if (hasText) {
      // The test audio says: "こんにちは、これはテストです。"
      record(
        "Japanese speech recognized",
        firstText.includes("こんにちは") || firstText.includes("テスト"),
        `Expected Japanese, got: "${firstText}"`,
      );
    }
  } else {
    record("Receive transcript segments", false, "0 segments received");
  }

  // --- 6. Close ---
  if (ws) {
    ws.close();
    ws = null;
  }
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
    console.log("\nAll E2E tests passed ✓");
    process.exit(0);
  }
}

runE2E();
