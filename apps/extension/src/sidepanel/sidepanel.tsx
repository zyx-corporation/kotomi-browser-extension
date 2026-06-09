// Side Panel — displays live transcript and export controls.
// For v0.1 alpha.2: listens for audio.chunk.metadata and displays chunk log.

import type { AudioChunkMetadataMessage, CaptureStateMessage } from "../shared/types";

const transcriptList = document.getElementById("transcript-list") as HTMLDivElement;
const statusEl = document.createElement("div");
statusEl.id = "capture-status";
statusEl.textContent = "Idle";
transcriptList.before(statusEl);

// --- Status display ---

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "capture.state") {
    const state = message as CaptureStateMessage;
    statusEl.textContent = `Status: ${state.status}${state.sessionId ? ` (${state.sessionId.slice(0, 8)}…)` : ""}`;
    if (state.status === "idle") {
      statusEl.style.color = "#888";
    } else if (state.status === "capturing") {
      statusEl.style.color = "#4caf50";
    } else if (state.status === "error") {
      statusEl.style.color = "#f44336";
      statusEl.textContent += ` — ${state.error ?? "unknown error"}`;
    }
  }

  // Display chunk metadata as it arrives
  if (message.type === "audio.chunk.metadata") {
    const meta = message as AudioChunkMetadataMessage;
    const row = document.createElement("div");
    row.className = "chunk-row";
    row.textContent = `#${meta.chunkIndex} | ${meta.sizeBytes}B | ${new Date(meta.timestampMs).toLocaleTimeString()}`;
    transcriptList.appendChild(row);

    // Auto-scroll to bottom
    transcriptList.scrollTop = transcriptList.scrollHeight;
  }
});

// Placeholder export buttons (wired in later alphas)
document.getElementById("export-md")?.addEventListener("click", () => {
  console.log("[sidepanel] export Markdown — not implemented yet");
});

document.getElementById("export-json")?.addEventListener("click", () => {
  console.log("[sidepanel] export JSON — not implemented yet");
});

console.log("[sidepanel] Kotomi side panel ready");
