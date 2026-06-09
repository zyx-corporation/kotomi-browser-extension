// Side Panel — displays live transcript, capture status, and transcriber connection.
// Listens for: capture.state, audio.chunk.metadata, transcriber.state, transcript.segment.relay

import type {
  AudioChunkMetadataMessage,
  CaptureStateMessage,
  TranscriberStateMessage,
  TranscriptSegmentRelayMessage,
} from "../shared/types";

const transcriptList = document.getElementById("transcript-list") as HTMLDivElement;
const statusEl = document.createElement("div");
statusEl.id = "capture-status";
statusEl.textContent = "Idle";
transcriptList.before(statusEl);

// --- Chunk counter ---

const chunkCountEl = document.createElement("div");
chunkCountEl.id = "chunk-count";
chunkCountEl.textContent = "Chunks: 0";
chunkCountEl.style.cssText = "font-size:12px; color:#888; margin-bottom:8px;";
statusEl.after(chunkCountEl);

let chunkCount = 0;

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

    const row = document.createElement("div");
    row.className = "transcript-segment";
    row.style.cssText = "padding:4px 0; border-bottom:1px solid #eee;";

    const timeLabel = `[${formatMs(seg.startMs)} - ${formatMs(seg.endMs)}]`;
    const confidenceStr = seg.confidence != null ? ` (${(seg.confidence * 100).toFixed(0)}%)` : "";
    row.textContent = `${timeLabel} ${seg.text}${confidenceStr}`;

    if (!seg.isFinal) {
      row.style.opacity = "0.6";
      row.style.fontStyle = "italic";
    }

    transcriptList.appendChild(row);
    transcriptList.scrollTop = transcriptList.scrollHeight;
  }
});

// --- Helpers ---

function formatMs(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const remaining = sec % 60;
  return `${String(min).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

// --- Export buttons (placeholder) ---

document.getElementById("export-md")?.addEventListener("click", () => {
  console.log("[sidepanel] export Markdown — not implemented yet");
});

document.getElementById("export-json")?.addEventListener("click", () => {
  console.log("[sidepanel] export JSON — not implemented yet");
});

console.log("[sidepanel] Kotomi side panel ready");
