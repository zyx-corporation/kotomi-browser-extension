# Architecture

## v0.1 Component Diagram

```
Popup
  ↓ start/stop
Background Service Worker
  ↓ create/control
Offscreen Document
  ↓ tabCapture + MediaRecorder
Kotomi Transcriber localhost
  ↓ transcript segments
Background / Storage
  ↓
Side Panel
```

## Components

### Popup
The popup page provides the user with explicit Start / Stop controls. It communicates with the Background Service Worker to initiate and terminate capture sessions.

### Background Service Worker
The service worker is the central orchestrator. It:
- Creates and manages the offscreen document for audio capture
- Relays audio chunks to the local Kotomi Transcriber
- Receives transcript segments and stores them
- Forwards transcript segments to the side panel

### Offscreen Document
The offscreen document hosts the `MediaRecorder` that captures tab audio via `chrome.tabCapture`. It is a hidden page created by the service worker solely for the purpose of accessing DOM APIs that are unavailable inside a service worker context.

### Kotomi Transcriber
A local transcription service running on `localhost`. The extension sends audio chunks to it and receives transcript segments back, typically over WebSocket.

### Side Panel
Displays the live transcript as segments arrive from the transcriber. Also provides export controls for Markdown and JSON output.
