# Architecture

## v0.1 Component Diagram

```
Popup
  ↓ start/stop
Background Service Worker
  ↓ create/control
Offscreen Document
  ↓ tabCapture.getMediaStreamId → getUserMedia → MediaRecorder
  │
  ├──→ audio.chunk.metadata ──→ Service Worker ──→ Side Panel
  │
  └──→ TranscriberClient (WebSocket)
        │  transcription.session.start
        │  transcription.audio.chunk (JSON + binary)
        │  transcription.session.stop
        │
        ◀ transcript.segment
        ◀ transcriber.state
        │
        └──→ chrome.runtime.sendMessage ──→ Service Worker ──→ Side Panel
```

## Components

### Popup
The popup page provides the user with explicit Start / Stop controls. It communicates with the Background Service Worker to initiate and terminate capture sessions.

### Background Service Worker
The service worker is the central orchestrator. It:
- Creates and manages the offscreen document for audio capture
- Relays audio chunk metadata and transcript segments to the side panel
- Broadcasts capture state and transcriber state to popup and side panel

### Offscreen Document
The offscreen document hosts:
1. **MediaStream** — obtained via `getUserMedia` with `chromeMediaSource: "tab"` constraints using the stream ID from `chrome.tabCapture.getMediaStreamId()`
2. **MediaRecorder** — encodes audio as `audio/webm;codecs=opus` with 1-second timeslices
3. **TranscriberClient** — WebSocket connection to the local Kotomi Transcriber

### TranscriberClient
A WebSocket client in `packages/kotomi-client` that:
- Connects to `ws://127.0.0.1:8765/v1/transcribe/stream`
- Sends `transcription.session.start` with session metadata
- Sends `transcription.audio.chunk` (JSON metadata) followed by binary audio frame
- Sends `transcription.session.stop` on capture end
- Receives `transcript.segment` and `transcriber.state` messages
- Supports reconnection (up to 3 attempts)

### Kotomi Transcriber
A local transcription service running on `localhost:8765`. For development, a mock transcriber is provided in `tools/mock-transcriber/` that returns mock transcript segments.

### Side Panel
Displays:
- Capture status (idle / capturing / error)
- Transcriber connection status
- Chunk count
- Live transcript segments with timestamps and confidence scores

## Data Flow

```
1. User clicks Start
2. Popup → Service Worker: capture.start
3. Service Worker:
   a. chrome.tabCapture.getMediaStreamId() → streamId
   b. chrome.offscreen.createDocument()
   c. Offscreen: offscreen.start { sessionId, streamId }
4. Offscreen:
   a. getUserMedia({ audio: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } })
   b. TranscriberClient.connect() → WebSocket to localhost:8765
   c. TranscriberClient.sendSessionStart()
   d. MediaRecorder.start(1000)

5. Every 1 second:
   a. MediaRecorder emits dataavailable
   b. Offscreen converts Blob → ArrayBuffer
   c. TranscriberClient.sendAudioChunk(JSON metadata, binary data)
   d. Offscreen sends audio.chunk.metadata → Service Worker → Side Panel
   e. Transcriber returns transcript.segment → Offscreen relays → Side Panel

6. User clicks Stop
7. Popup → Service Worker: capture.stop
8. Service Worker → Offscreen: offscreen.stop
9. Offscreen:
   a. MediaRecorder.stop()
   b. TranscriberClient.sendSessionStop({ reason: "user_stop" })
   c. TranscriberClient.disconnect()
   d. mediaStream.getTracks().forEach(track => track.stop())
10. Service Worker: chrome.offscreen.closeDocument()
```
