# Transcription Protocol

The extension communicates with the local Kotomi Transcriber over WebSocket.

## Endpoint

```
ws://127.0.0.1:8765/v1/transcribe/stream
```

## Message Flow

```
Extension                    Transcriber
   │                             │
   │─── transcription.session.start ──▶
   │                             │
   │─── transcription.audio.chunk (JSON) ──▶
   │─── <binary audio frame> ─────▶
   │─── transcription.audio.chunk (JSON) ──▶
   │─── <binary audio frame> ─────▶
   │                             │
   │◀── transcript.segment ──────────│
   │◀── transcript.segment ──────────│
   │                             │
   │─── transcription.session.stop ──▶
   │       (reason: "user_stop" | "error" | "capture_ended")
```

## Binary Frame Convention

Each audio chunk is sent as two WebSocket frames:
1. **JSON text frame** — `transcription.audio.chunk` metadata
2. **Binary frame** — `ArrayBuffer` containing the audio data (`audio/webm;codecs=opus`)

The server interprets the binary frame as belonging to the most recently received `transcription.audio.chunk` message.

## Message Types

### `transcription.session.start`

Sent when capture begins.

```json
{
  "type": "transcription.session.start",
  "sessionId": "<uuid>",
  "source": {
    "type": "tab_audio",
    "url": "<optional tab URL>",
    "title": "<optional tab title>"
  },
  "audio": {
    "mimeType": "audio/webm;codecs=opus",
    "timesliceMs": 1000
  },
  "options": {
    "language": "ja | en | auto",
    "interim": true
  }
}
```

### `transcription.audio.chunk`

JSON metadata sent immediately before each binary audio frame.

```json
{
  "type": "transcription.audio.chunk",
  "sessionId": "<uuid>",
  "chunkIndex": 0,
  "timestampMs": 1718100000000,
  "mimeType": "audio/webm;codecs=opus"
}
```

### `transcript.segment`

Received from the transcriber.

```json
{
  "type": "transcript.segment",
  "sessionId": "<uuid>",
  "segmentId": "seg-0001",
  "startMs": 0,
  "endMs": 3000,
  "text": "文字起こし結果",
  "isFinal": true,
  "confidence": 0.99,
  "speaker": null
}
```

### `transcription.session.stop`

Sent when capture ends.

```json
{
  "type": "transcription.session.stop",
  "sessionId": "<uuid>",
  "reason": "user_stop | error | capture_ended"
}
```

### `transcriber.error`

Received from the transcriber on error.

```json
{
  "type": "transcriber.error",
  "sessionId": "<uuid or null>",
  "message": "error description",
  "detail": {}
}
```

### `transcriber.state`

Received from the transcriber for connection state.

```json
{
  "type": "transcriber.state",
  "status": "disconnected | connecting | connected | error",
  "sessionId": "<uuid or null>",
  "message": "<optional detail>"
}
```

## Session Lifecycle

1. Extension connects to WebSocket endpoint
2. Extension sends `transcription.session.start` with session metadata
3. Extension begins sending `transcription.audio.chunk` + binary frames at regular intervals (default: 1 second)
4. Transcriber returns `transcript.segment` messages as they become available
5. Extension sends `transcription.session.stop` when capture ends
6. Extension closes WebSocket connection
