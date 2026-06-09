# Known Limitations — v0.1.0

## ASR

- Mock transcriber returns hardcoded text (development only)
- Real ASR (faster-whisper) requires separate Python environment setup
- CPU transcription with `small` model takes several seconds per 3-second chunk
- No streaming (partial) transcription — segments returned only after batch completes
- Default language is Japanese (`ja`). Language switching not yet in UI
- VAD (Voice Activity Detection) enabled but may degrade on BGM-heavy audio

## Capture

- Only active tab audio captured — microphone not supported in v0.1.0
- Tab must remain active during capture (Chrome limitation)
- Audio format fixed to `audio/webm;codecs=opus` / 64kbps
- No pause/resume during capture

## Export

- Export available only after capture (no live streaming export)
- File download only — no clipboard export
- Markdown text may contain unescaped special characters (`|`, `[`, `]`)
- JSON schema version `"0.1.0"` — may change in future releases
- No automatic migration between schema versions

## Storage

- Only current session persisted (`chrome.storage.local`)
- No multi-session history
- Debounce saves (1 second). Crash within 1s of last segment may lose data
- Storage quota: `chrome.storage.local` (~10MB default)
- No cloud sync or cross-device sharing
- No automatic cleanup of old sessions

## UI

- Side Panel only — no separate transcript viewer window
- No zoom/font size controls
- No segment editing or correction
- No audio playback linked to segments
- Clear Transcript is irreversible (future: undo support)

## Browser

- Chrome / Chromium only (Manifest V3)
- No Firefox or Safari support
- Not available on Chrome Web Store
- Requires "Developer mode" to load unpacked

## Adapter

- Faster-whisper adapter requires ffmpeg for audio conversion
- Python service is single-process — no concurrent sessions
- Model download on first run (~500MB for `small`)

## Non-goals (intentionally out of scope)

- Cloud transcription
- Automatic / background recording
- Page content scraping
- Speaker diarization
- Meeting summarization
- RDE event generation
- Kotomi Core synchronization
- Multi-language UI
- Mobile browser support
