// Side Panel — displays live transcript, capture status, and transcriber connection.
// Listens for: capture.state, audio.chunk.metadata, transcriber.state, transcript.segment.relay
// Provides: Markdown export, JSON export, Clear transcript, local storage persistence

import type {
  AudioChunkMetadataMessage,
  CaptureStateMessage,
  TranscriberStateMessage,
  TranscriptSegmentRelayMessage,
} from "../shared/types";
import type { StoredSegment } from "../../../../packages/transcript-core/src/transcript";
import { exportMarkdown } from "../../../../packages/transcript-core/src/export-markdown";
import { exportJSON } from "../../../../packages/transcript-core/src/export-json";
import {
  serializeSession,
  deserializeSession,
  isValidPersistedSession,
  STORAGE_KEY,
  type PersistedSession,
} from "../../../../packages/transcript-core/src/storage";

// --- DOM Elements ---

const transcriptList = document.getElementById("transcript-list") as HTMLDivElement;
const exportMdBtn = document.getElementById("export-md") as HTMLButtonElement;
const exportJSONBtn = document.getElementById("export-json") as HTMLButtonElement;
const clearBtn = document.getElementById("clear-transcript") as HTMLButtonElement;
const saveStateEl = document.getElementById("save-state") as HTMLDivElement;

// --- Status / Count Elements ---

const statusEl = document.createElement("div");
statusEl.id = "capture-status";
statusEl.textContent = "Idle";
transcriptList.before(statusEl);

const chunkCountEl = document.createElement("div");
chunkCountEl.id = "chunk-count";
chunkCountEl.textContent = "Chunks: 0";
chunkCountEl.style.cssText = "font-size:12px; color:#888; margin-bottom:8px;";
statusEl.after(chunkCountEl);

// --- State ---

let chunkCount = 0;
let sessionId: string | null = null;
let sessionCreatedAt: number = 0;
let transcriberState: string | null = null;
let segments: StoredSegment[] = [];
let captureStartTime = 0;
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let savePending = false;
const SAVE_DEBOUNCE_MS = 1000;

// --- Save state indicator ---

function setSaveState(text: string, color: string = "#4caf50"): void {
  saveStateEl.textContent = text;
  saveStateEl.style.color = color;
}

// --- Storage ---

async function loadFromStorage(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const data = result[STORAGE_KEY];

    if (!data || !isValidPersistedSession(data)) {
      if (data) {
        console.warn("[sidepanel] stored data invalid, clearing");
        await chrome.storage.local.remove(STORAGE_KEY);
      }
      return false;
    }

    const persisted = data as PersistedSession;
    sessionId = persisted.sessionId;
    sessionCreatedAt = persisted.createdAt;
    captureStartTime = persisted.metadata.startedAt;
    transcriberState = persisted.metadata.transcriberState ?? null;
    segments = persisted.segments;

    // Rebuild DOM
    transcriptList.innerHTML = "";
    for (const seg of persisted.segments) {
      const row = createSegmentRow(seg);
      transcriptList.appendChild(row);
    }

    updateExportButtons();
    setSaveState(
      `Restored from local storage — ${persisted.segments.length} segments (${new Date(persisted.updatedAt).toLocaleTimeString()})`,
      "#4caf50",
    );
    console.log(`[sidepanel] restored session ${sessionId} with ${segments.length} segments`);
    return true;
  } catch (err) {
    console.error("[sidepanel] failed to load from storage:", err);
    setSaveState("Storage read failed", "#f44336");
    return false;
  }
}

async function saveToStorage(): Promise<void> {
  if (!sessionId || segments.length === 0) return;

  try {
    const session = buildSessionObject();
    if (!session) return;

    const persisted = serializeSession(session, sessionCreatedAt || undefined);
    await chrome.storage.local.set({ [STORAGE_KEY]: persisted });

    setSaveState(`Saved locally ${new Date().toLocaleTimeString().slice(0, 5)}`, "#4caf50");
    console.log(`[sidepanel] saved ${segments.length} segments to storage`);
  } catch (err) {
    console.error("[sidepanel] failed to save to storage:", err);
    setSaveState("Save failed", "#f44336");
  }
}

function debouncedSave(): void {
  if (!sessionId) return;

  setSaveState("Unsaved changes…", "#ff9800");
  savePending = true;

  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(async () => {
    savePending = false;
    await saveToStorage();
  }, SAVE_DEBOUNCE_MS);
}

async function clearStorage(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
    console.log("[sidepanel] storage cleared");
  } catch (err) {
    console.error("[sidepanel] failed to clear storage:", err);
  }
}

// --- Build session object ---

function buildSessionObject(): StoredSession | null {
  if (!sessionId || segments.length === 0) return null;

  return {
    sessionId,
    segments,
    metadata: {
      source: "Kotomi Browser Extension v0.1.0",
      captureMode: "tab_audio" as const,
      startedAt: captureStartTime || Date.now(),
      endedAt: Date.now(),
      transcriberState: transcriberState ?? undefined,
    },
  };
}

interface StoredSession {
  sessionId: string;
  segments: StoredSegment[];
  metadata: {
    source: string;
    captureMode: "tab_audio" | "microphone";
    startedAt: number;
    endedAt?: number;
    transcriberState?: string;
  };
}

function updateExportButtons(): void {
  const hasSegments = segments.length > 0;
  exportMdBtn.disabled = !hasSegments;
  exportJSONBtn.disabled = !hasSegments;
  clearBtn.disabled = !hasSegments;
}

// --- Export ---

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateFilename(ext: string): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const shortId = (sessionId ?? "unknown").slice(0, 6);
  return `kotomi-transcript-${date}-${time}-${shortId}.${ext}`;
}

exportMdBtn.addEventListener("click", () => {
  const session = buildSessionObject();
  if (!session) return;

  const md = exportMarkdown(session);
  downloadFile(md, generateFilename("md"), "text/markdown;charset=utf-8");
  console.log("[sidepanel] Markdown exported");
});

exportJSONBtn.addEventListener("click", () => {
  const session = buildSessionObject();
  if (!session) return;

  const json = exportJSON(session);
  downloadFile(json, generateFilename("json"), "application/json;charset=utf-8");
  console.log("[sidepanel] JSON exported");
});

// --- Clear ---

clearBtn.addEventListener("click", () => {
  if (segments.length === 0) return;
  if (!confirm(`Clear ${segments.length} transcript segments and remove from local storage? This cannot be undone.`)) return;

  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);

  segments = [];
  sessionId = null;
  sessionCreatedAt = 0;
  captureStartTime = 0;
  transcriptList.innerHTML = "";
  updateExportButtons();
  clearStorage();
  setSaveState("", "#888");
  console.log("[sidepanel] transcript cleared");
});

// --- Message handling ---

chrome.runtime.onMessage.addListener((message) => {
  // Capture state
  if (message.type === "capture.state") {
    const state = message as CaptureStateMessage;
    let text = `Status: ${state.status}`;
    if (state.sessionId) text += ` (${state.sessionId.slice(0, 8)}…)`;
    if (state.error) text += ` — ${state.error}`;

    statusEl.textContent = text;
    statusEl.style.color =
      state.status === "capturing" ? "#4caf50" :
      state.status === "error" ? "#f44336" :
      "#888";

    // New capture starting — flush existing session if needed
    if (state.status === "capturing" && state.sessionId) {
      const isNewSession = sessionId !== state.sessionId;
      if (isNewSession) {
        if (sessionId && segments.length > 0) {
          if (savePending && saveDebounceTimer) {
            clearTimeout(saveDebounceTimer);
            saveToStorage();
          }
        }
        sessionId = state.sessionId;
        captureStartTime = Date.now();
        sessionCreatedAt = Date.now();
        chunkCount = 0;
        chunkCountEl.textContent = "Chunks: 0";
      }
    }

    // Capture stopped — flush pending save
    if (state.status === "idle") {
      chunkCount = 0;
      chunkCountEl.textContent = "Chunks: 0";
      if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
      if (savePending) saveToStorage();
    }
  }

  // Chunk metadata
  if (message.type === "audio.chunk.metadata") {
    chunkCount++;
    chunkCountEl.textContent = `Chunks: ${chunkCount}`;
  }

  // Transcriber connection state
  if (message.type === "transcriber.state") {
    const state = message as TranscriberStateMessage;
    transcriberState = state.status;
    chunkCountEl.textContent = `Chunks: ${chunkCount} | Transcriber: ${state.status}`;
    if (state.status === "connected") {
      chunkCountEl.style.color = "#4caf50";
    } else if (state.status === "error") {
      chunkCountEl.style.color = "#f44336";
    } else {
      chunkCountEl.style.color = "#888";
    }
  }

  // Transcript segment
  if (message.type === "transcript.segment.relay") {
    const relay = message as TranscriptSegmentRelayMessage;
    const seg = relay.segment;

    const existingIdx = segments.findIndex((s) => s.segmentId === seg.segmentId);
    const stored: StoredSegment = {
      ...seg,
      receivedAt: Date.now(),
    };

    if (existingIdx >= 0) {
      segments[existingIdx] = stored;
      const existingRow = transcriptList.querySelector(`[data-seg-id="${seg.segmentId}"]`);
      if (existingRow) {
        updateSegmentRow(existingRow as HTMLDivElement, stored);
      }
    } else {
      segments.push(stored);
      const row = createSegmentRow(stored);
      transcriptList.appendChild(row);
      transcriptList.scrollTop = transcriptList.scrollHeight;
    }

    updateExportButtons();
    debouncedSave();
  }
});

// --- Segment rendering ---

function createSegmentRow(seg: StoredSegment): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "transcript-segment";
  row.setAttribute("data-seg-id", seg.segmentId);
  updateSegmentRow(row, seg);
  return row;
}

function updateSegmentRow(row: HTMLDivElement, seg: StoredSegment): void {
  const timeLabel = `[${formatMs(seg.startMs)} - ${formatMs(seg.endMs)}]`;
  const confidenceStr = seg.confidence != null ? ` (${(seg.confidence * 100).toFixed(0)}%)` : "";
  row.textContent = `${timeLabel} ${seg.text}${confidenceStr}`;

  if (!seg.isFinal) {
    row.style.opacity = "0.6";
    row.style.fontStyle = "italic";
  } else {
    row.style.opacity = "1";
    row.style.fontStyle = "normal";
  }
}

// --- Helpers ---

function formatMs(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const remaining = sec % 60;
  return `${String(min).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

// --- Startup: restore from storage ---

loadFromStorage();

console.log("[sidepanel] Kotomi side panel ready");
