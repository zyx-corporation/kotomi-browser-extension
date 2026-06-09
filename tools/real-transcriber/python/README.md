# Kotomi ASR Service (Python)

Local HTTP service wrapping faster-whisper for speech recognition.

## Prerequisites

- Python 3.10+
- ffmpeg (for audio conversion)
- CUDA-compatible GPU recommended, CPU also works

## Installation

```bash
cd tools/real-transcriber/python
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Usage

```bash
python asr_service.py
```

The service starts on `http://127.0.0.1:8766` by default.

Environment variables:
- `ASR_PORT` — HTTP port (default: 8766)
- `ASR_MODEL` — faster-whisper model size: `tiny`, `base`, `small`, `medium`, `large-v3` (default: `small`)
- `ASR_DEVICE` — `cpu` or `cuda` (default: `cpu`)
- `ASR_COMPUTE_TYPE` — `int8`, `float16`, etc. (default: `int8`)

## API

### GET /v1/health

```json
{
  "status": "ok",
  "model": "small",
  "device": "cpu"
}
```

### POST /v1/transcribe

Multipart form upload with `audio` field containing WAV audio (16kHz, mono, 16-bit PCM).

Response:

```json
{
  "text": "認識された文字列",
  "confidence": 0.95
}
```

## Notes

- The model is downloaded automatically on first run (~500MB for `small`)
- CPU transcription is slower but works without GPU
- For production use, consider `medium` or `large-v3` models
