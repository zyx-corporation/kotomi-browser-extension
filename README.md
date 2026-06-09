# Kotomi Browser Extension

Chrome extension for capturing browser tab audio and transcribing it through Kotomi.

ブラウザタブ音声を取得し、Kotomi で文字起こしする Chrome 拡張。

## Status

**v0.1.0 — Local Transcription MVP**

> capture → transcribe → export → local persistence の最小系が成立。
> 47 automated tests, 0 failures.

## Quick Start

```bash
# 1. Start the mock transcriber (no Python/ASR dependencies)
cd tools/mock-transcriber && npm install && npm start

# 2. Load the extension in Chrome
# chrome://extensions → Developer mode → Load unpacked → apps/extension/

# 3. Open a tab with audio, click Kotomi icon, Start
# Transcript appears in the Side Panel

# 4. Export as Markdown or JSON
```

## Development

```bash
npm install
npm run typecheck                    # TypeScript check
npm run test:export-serializers      # 18 tests
npm run test:storage-persistence     # 15 tests
npm run test:mock-transcriber        # 6 tests (needs server running)
npm run test:real-transcriber        # 8 tests (needs server running)
```

## Architecture

See [docs/architecture.md](docs/architecture.md).

```
Browser Tab Audio
  → chrome.tabCapture
  → Offscreen Document (MediaRecorder, opus)
  → WebSocket → Kotomi Transcriber (localhost:8765)
  → transcript.segment
  → Side Panel (display + local storage + export)
```

## Documentation

| Document | Description |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Full architecture with component diagrams |
| [docs/transcription-protocol.md](docs/transcription-protocol.md) | WebSocket protocol specification |
| [docs/privacy-design.md](docs/privacy-design.md) | Privacy principles and data flow |
| [docs/permissions.md](docs/permissions.md) | Permission rationale |
| [docs/release-notes-v0.1.0.md](docs/release-notes-v0.1.0.md) | v0.1.0 release notes |
| [docs/known-limitations-v0.1.0.md](docs/known-limitations-v0.1.0.md) | Known limitations |
| [docs/smoke-v0.1.0.md](docs/smoke-v0.1.0.md) | RC smoke verification |

## Goals

- Capture audio from the active browser tab
- Stream audio chunks to a local transcription backend
- Display live transcript in the browser side panel
- Persist transcripts locally in the browser
- Export transcripts as Markdown and JSON
- Keep user control explicit: no background recording, no silent upload

## Non-goals

- General web scraping
- Browser history analysis
- Hidden monitoring
- Cloud-only transcription
- Automatic recording without user action
- Semantic summarization (future work)
- Speaker diarization (future work)
