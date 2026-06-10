// Background service worker — orchestrates audio capture lifecycle.
// - Receives capture.start / capture.stop from popup
// - Creates and manages offscreen document for tabCapture
// - Routes audio chunk metadata and transcript segments to side panel
// - Broadcasts capture and transcriber state to popup and side panel

import type {
  CaptureStateMessage,
  AudioChunkMetadataMessage,
  TranscriptSegmentRelayMessage,
  TranscriberStateMessage,
} from "../shared/types";

const OFFSCREEN_DOCUMENT_PATH = "src/offscreen/offscreen.html";
let currentSessionId: string | null = null;
let offscreenCreating: Promise<void> | null = null;
let transcriberStatus: TranscriberStateMessage["status"] = "disconnected";

// --- Offscreen document management ---

async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  });
  return contexts.length > 0;
}

async function createOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    console.log("[service-worker] offscreen document already exists");
    return;
  }

  if (offscreenCreating) {
    await offscreenCreating;
    return;
  }

  offscreenCreating = chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: "Tab audio capture for Kotomi transcription",
  });

  try {
    await offscreenCreating;
    console.log("[service-worker] offscreen document created");
  } finally {
    offscreenCreating = null;
  }
}

async function closeOffscreenDocument(): Promise<void> {
  if (!(await hasOffscreenDocument())) return;

  try {
    await chrome.offscreen.closeDocument();
    console.log("[service-worker] offscreen document closed");
  } catch (err) {
    console.warn("[service-worker] failed to close offscreen document:", err);
  }
}

// --- Capture lifecycle ---

async function startCapture(): Promise<void> {
  if (currentSessionId) {
    console.warn("[service-worker] capture already active, session:", currentSessionId);
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error("no active tab found");

    const sessionId = crypto.randomUUID();
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id,
    });

    console.log("[service-worker] streamId obtained, tab:", tab.id);

    await createOffscreenDocument();

    chrome.runtime.sendMessage({
      type: "offscreen.start",
      sessionId,
      streamId,
    });

    currentSessionId = sessionId;
    transcriberStatus = "connecting";

    broadcastState("capturing", sessionId);
  } catch (err) {
    console.error("[service-worker] failed to start capture:", err);
    broadcastState("error", undefined, String(err));
  }
}

async function stopCapture(): Promise<void> {
  if (!currentSessionId) {
    console.warn("[service-worker] no active capture to stop");
    return;
  }

  try {
    chrome.runtime.sendMessage({ type: "offscreen.stop" });
  } catch (err) {
    console.warn("[service-worker] error sending stop to offscreen:", err);
  }

  currentSessionId = null;
  transcriberStatus = "disconnected";
  broadcastState("idle");

  // Wait for offscreen to receive and relay the final transcript
  // before closing it. The server needs time to transcribe accumulated audio.
  await new Promise((resolve) => setTimeout(resolve, 15000));

  await closeOffscreenDocument();
}

function broadcastState(
  status: CaptureStateMessage["status"],
  sessionId?: string,
  error?: string,
): void {
  const message: CaptureStateMessage = {
    type: "capture.state",
    status,
    sessionId,
    error,
  };

  chrome.runtime.sendMessage(message).catch(() => {
    // Popup may be closed — that's expected
  });
}

// --- Message routing ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "capture.start") {
    startCapture();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "capture.stop") {
    stopCapture();
    sendResponse({ ok: true });
    return true;
  }

  // Audio chunk metadata from offscreen → logged here, side panel listens directly
  if (message.type === "audio.chunk.metadata") {
    const meta = message as AudioChunkMetadataMessage;
    console.log(
      `[service-worker] chunk #${meta.chunkIndex} | ${meta.sizeBytes} bytes | ${meta.timestampMs}ms`,
    );
    return false;
  }

  // Transcript segment relay from offscreen → logged here, side panel listens directly
  if (message.type === "transcript.segment.relay") {
    const relay = message as TranscriptSegmentRelayMessage;
    console.log(
      `[service-worker] transcript segment: "${relay.segment.text}"`,
    );
    return false;
  }

  // Transcriber state update from offscreen
  if (message.type === "transcriber.state") {
    const state = message as TranscriberStateMessage;
    transcriberStatus = state.status;
    console.log(`[service-worker] transcriber state: ${state.status}`);
    return false;
  }

  // Popup querying current state (on open)
  if (message.type === "capture.state") {
    broadcastState(currentSessionId ? "capturing" : "idle", currentSessionId ?? undefined);
    return false;
  }

  return false;
});

console.log("[service-worker] Kotomi service worker ready");
