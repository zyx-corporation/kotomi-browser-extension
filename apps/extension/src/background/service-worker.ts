// Background service worker — orchestrates audio capture lifecycle.
// - Receives capture.start / capture.stop from popup
// - Creates and manages offscreen document for tabCapture
// - Routes audio chunk metadata to side panel
// - Broadcasts capture state to popup and side panel

import type { CaptureStateMessage, AudioChunkMetadataMessage } from "../shared/types";

const OFFSCREEN_DOCUMENT_PATH = "src/offscreen/offscreen.html";
let currentSessionId: string | null = null;
let offscreenCreating: Promise<void> | null = null;

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
    // Get active tab metadata
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error("no active tab found");

    const sessionId = crypto.randomUUID();
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id,
    });

    console.log("[service-worker] streamId obtained, tab:", tab.id);

    // Create offscreen document if needed
    await createOffscreenDocument();

    // Send start command to offscreen with stream ID
    chrome.runtime.sendMessage({
      type: "offscreen.start",
      sessionId,
      streamId,
    });

    currentSessionId = sessionId;

    // Broadcast capturing state
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
    // Tell offscreen to stop
    chrome.runtime.sendMessage({ type: "offscreen.stop" });
  } catch (err) {
    console.warn("[service-worker] error sending stop to offscreen:", err);
  }

  // Clean up
  currentSessionId = null;
  await closeOffscreenDocument();
  broadcastState("idle");
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

  // Send to popup (if open) and side panel
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

  // Forward audio chunk metadata from offscreen to side panel
  if (message.type === "audio.chunk.metadata") {
    const meta = message as AudioChunkMetadataMessage;
    console.log(
      `[service-worker] chunk #${meta.chunkIndex} | ${meta.sizeBytes} bytes | ${meta.timestampMs}ms`,
    );
    // Already broadcast via runtime.onMessage — side panel can listen directly
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
