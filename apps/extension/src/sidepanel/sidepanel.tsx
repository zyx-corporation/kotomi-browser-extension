// Side Panel — displays live transcript, capture status, and transcriber connection.
// Listens for: capture.state, audio.chunk.metadata, transcriber.state, transcript.segment.relay
// Provides: Markdown export, JSON export, Clear transcript

import type {
  AudioChunkMetadataMessage,
  CaptureStateMessage,
  TranscriberStateMessage,
  TranscriptSegmentRelayMessage,
  TranscriptSegmentMessage,
} from "../shared/types";
import type { StoredSegment } from "../../../../packages/transcript-core/src/transcript";
import { exportMarkdown } from "../../../../packages/transcript-core/src/export-markdown";
import { exportJSON } from "../../../../packages/transcript-core/src/export-json";
import {
  createTranscriptSession,
  upsertSegment,
  type TranscriptSession,
} from "../../../../packages/transcript-core/src/transcript";

// --- DOM Elements ---

const transcriptList = document.getElementById("transcript-list") as HTMLDivElement;
const exportMdBtn = document.getElementById("export-md") as HTMLButtonElement;
const exportJSONBtn = document.getElementById("export-json") as HTMLButtonElement;
const clearBtn = document.getElementById("clear-transcript") as HTMLButtonElement;

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
let transcriberState: string | null = null;
let segments: StoredSegment[] = [];
let captureStartTime = 0;

function updateExportButtons(): void {
  const hasSegments = segments.length > 0;
  exportMdBtn.disabled = !hasSegments;
  exportJSONBtn.disabled = !hasSegments;
  clearBtn.disabled = !hasSegments;
}

function buildSession(): TranscriptSession | null {
  if (!sessionId || segments.length === 0) return null;

  return createTranscriptSession(sessionId, {
    startedAt: captureStartTime || Date.now(),
    endedAt: Date.now(),
    transcriberState: transcriberState ?? undefined,
  }).segments.length > 0
    ? {
        sessionId,
        segments,
        metadata: {
          source: "Kotomi Browser Extension v0.1.0",
          captureMode: "tab_audio" as const,
          startedAt: captureStartTime || Date.now(),
          endedAt: Date.now(),
          transcriberState: transcriberState ?? undefined,
        },
      }
    : null;
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
  const session = buildSession();
  if (!session) return;

  const md = exportMarkdown(session);
  downloadFile(md, generateFilename("md"), "text/markdown;charset=utf-8");
  console.log("[sidepanel] Markdown exported");
});

exportJSONBtn.addEventListener("click", () => {
  const session = buildSession();
  if (!session) return;

  const json = exportJSON(session);
  downloadFile(json, generateFilename("json"), "application/json;charset=utf-8");
  console.log("[sidepanel] JSON exported");
});

// --- Clear ---

clearBtn.addEventListener("click", () => {
  if (segments.length === 0) return;
  if (!confirm(`Clear ${segments.length} transcript segments? This cannot be undone.`)) return;

  segments = [];
  sessionId = null;
  captureStartTime = 0;
  transcriptList.innerHTML = "";
  updateExportButtons();
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

    if (state.status === "capturing" && state.sessionId) {
      sessionId = state.sessionId;
      if (captureStartTime === 0) captureStartTime = Date.now();
    }

    if (state.status === "idle") {
      chunkCount = 0;
      chunkCountEl.textContent = "Chunks: 0";
    }
  }

  // Chunk metadata
  if (message.type === "audio.chunk.metadata") {
    const meta = message as AudioChunkMetadataMessage;
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

    // Store segment with receivedAt timestamp
    const existingIdx = segments.findIndex((s) => s.segmentId === seg.segmentId);
    const stored: StoredSegment = {
      ...seg,
      receivedAt: Date.now(),
    };

    if (existingIdx >= 0) {
      segments[existingIdx] = stored;
      // Update DOM row
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

console.log("[sidepanel] Kotomi side panel ready");
