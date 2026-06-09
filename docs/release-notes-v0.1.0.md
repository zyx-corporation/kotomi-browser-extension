# Kotomi Browser Extension — v0.1.0 Release Notes

## Summary

Kotomi Browser Extension v0.1.0 is a **local-first transcript capture/export prototype**.
It captures audio from the active browser tab, streams it to a local Kotomi transcription service, displays the transcript in the side panel, and exports it as Markdown or JSON.

## What's in v0.1.0

- **Tab audio capture** via `chrome.tabCapture` + `MediaRecorder` (audio/webm;codecs=opus)
- **WebSocket transport** to local transcriber at `ws://127.0.0.1:8765/v1/transcribe/stream`
- **Pluggable ASR adapter** — mock backend (zero dependencies) or faster-whisper (Python)
- **Live transcript display** in Chrome Side Panel
- **Local persistence** via `chrome.storage.local` — survives panel reload
- **Markdown export** — human-readable with metadata, timestamps, confidence
- **JSON export** — machine-readable with schemaVersion for downstream processing
- **Explicit user control** — no background recording, no silent upload
- **Privacy-first** — default endpoint is localhost, no cloud transmission

## How to try it

### Prerequisites
- Chrome / Chromium browser
- Node.js 18+

### 1. Start the transciber (mock)
```bash
cd tools/mock-transcriber
npm install
npm start
# → ws://127.0.0.1:8765/v1/transcribe/stream
```

### 2. Load the extension
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `apps/extension/` directory

### 3. Start capturing
1. Open a tab with audio (e.g., YouTube)
2. Click the Kotomi icon → Popup → Start
3. Open the Side Panel to see the transcript
4. Click Stop when done
5. Export as Markdown or JSON

## Architecture

```
Browser Tab Audio
  → chrome.tabCapture
  → Offscreen Document (MediaRecorder)
  → WebSocket → Kotomi Transcriber (localhost)
  → transcript.segment
  → Side Panel (display + local storage + export)
```

## Limitations

See [docs/known-limitations-v0.1.0.md](./known-limitations-v0.1.0.md) for full details.

- Real ASR (faster-whisper) requires Python 3.10+ environment
- No speaker diarization
- No multi-session history
- No clipboard export
- No background capture — tab must be active
- Not available on Chrome Web Store yet

## v0.1.0 MVP Criteria

- [x] Capture active tab audio
- [x] Stream to local transcriber
- [x] Display transcript in side panel
- [x] Export Markdown / JSON
- [x] Local persistence
- [x] User-initated capture only
- [x] No cloud transmission
