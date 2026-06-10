# Kotomi Real Transcriber

Pluggable ASR transcriber server for the Kotomi Browser Extension.

## Architecture

```
Browser Extension (WebSocket)
       │
       ▼
┌──────────────────────────────┐
│  tools/real-transcriber/     │
│  src/server.ts               │  ← WebSocket server (protocol handler)
│       │                      │
│       ▼                      │
│  src/asr-adapter.ts          │  ← ASR interface
│       │                      │
│   ┌───┴───┐                 │
│   │       │                  │
│   ▼       ▼                  │
│ Mock    Faster-Whisper       │
│ Adapter  Adapter             │
│              │               │
│              ▼               │
│     ffmpeg (convert)          │
│              │               │
│              ▼               │
│     Python ASR Service        │
│     (faster-whisper)          │
└──────────────────────────────┘
```

## Quick Start

### Mock backend (no Python/ASR dependencies)

```bash
cd tools/real-transcriber
npm install
npm start          # defaults to mock backend
```

### Faster-Whisper backend (real ASR)

**Terminal 1 — Python ASR service:**
```bash
cd tools/real-transcriber/python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python asr_service.py
# → http://127.0.0.1:8766
```

**Terminal 2 — Node WebSocket server:**
```bash
cd tools/real-transcriber
npm install
npm run start:faster-whisper
# → ws://127.0.0.1:8765/v1/transcribe/stream
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `TRANSCRIBER_BACKEND` | `mock` | ASR backend: `mock` or `faster-whisper` |
| `TRANSCRIBER_PORT` | `8765` | WebSocket server port |
| `CHUNKS_PER_SEGMENT` | `3` | Audio chunks to buffer before transcribing |
| `WHISPER_SERVICE_URL` | `http://127.0.0.1:8766` | Python ASR service endpoint |
| `ASR_PORT` | `8766` | Python service port |
| `ASR_MODEL` | `small` | faster-whisper model size |
| `ASR_DEVICE` | `cpu` | `cpu` or `cuda` |
| `ASR_COMPUTE_TYPE` | `int8` | Quantization type |

## Switching from mock-transcriber

The real-transcriber uses the **same WebSocket endpoint** and **same protocol** as `tools/mock-transcriber/`. They are drop-in replacements for each other. The browser extension doesn't need any configuration change.

## Testing

```bash
# Start the server first (in another terminal)
npm run start:mock

# Run smoke test
npx tsx tests/real-transcriber-smoke.test.ts
```

## Dependencies

- **mock backend**: nothing beyond Node.js
- **faster-whisper backend**: Python 3.10〜3.12 (3.13+ 不可), faster-whisper, ffmpeg

> Python バージョン制約の詳細は [python/README.md](python/README.md) を参照。

## Testing (Real ASR)

```bash
# E2E テストの実行 (Python ASR + Node サーバーが起動済みであること)
npx tsx tests/real-asr-e2e.test.ts
```

テスト用音声ファイルの準備:
```bash
say -o /tmp/test.aiff "こんにちは、これはテストです。"
ffmpeg -y -i /tmp/test.aiff -c:a libopus -b:a 64k -ar 48000 -ac 1 /tmp/kotomi-test-speech.webm
```
