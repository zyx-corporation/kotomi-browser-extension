// Offscreen document — hosts MediaRecorder and TranscriberClient for tab audio capture.
// - Receives "offscreen.start" with streamId from service worker
// - Obtains MediaStream via getUserMedia with chromeMediaSource constraints
// - Creates MediaRecorder with `audio/webm;codecs=opus`
// - Creates TranscriberClient and connects to local Kotomi transcriber
// - Sends JSON metadata + binary audio chunks over WebSocket
// - Relays transcript.segment and transcriber.state to service worker
// - Stops cleanly on "offscreen.stop"

import { TranscriberClient, type TranscriberState } from "../../../../packages/kotomi-client/src/transcriber-client";
import type {
  TranscriptionSessionStartMessage,
  TranscriptionAudioChunkMessage,
  TranscriptionSessionStopMessage,
  TranscriptSegmentMessage,
  TranscriberErrorMessage,
} from "../shared/types";

let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let transcriber: TranscriberClient | null = null;
let sessionId: string | null = null;
let chunkIndex = 0;
let captureStartTime = 0;

// --- Transcriber callbacks ---

function onTranscriberState(state: TranscriberState, message?: string): void {
  console.log(`[offscreen] transcriber state: ${state}${message ? ` (${message})` : ""}`);
  chrome.runtime.sendMessage({
    type: "transcriber.state",
    status: state,
    sessionId,
    message,
  }).catch(() => {});
}

function onTranscriptSegment(segment: TranscriptSegmentMessage): void {
  console.log(`[offscreen] transcript: "${segment.text}"`);
  chrome.runtime.sendMessage({
    type: "transcript.segment.relay",
    segment,
  }).catch(() => {});

  // Signal that we received the final transcript (used by stopCapture wait)
  if (stopResolveWait) {
    stopResolveWait();
    stopResolveWait = null;
  }
}

function onTranscriberError(error: TranscriberErrorMessage): void {
  console.error("[offscreen] transcriber error:", error.message);
  chrome.runtime.sendMessage({
    type: "transcriber.error",
    sessionId,
    message: error.message,
    detail: error.detail,
  }).catch(() => {});
}

// --- Capture ---

async function startCapture(streamId: string): Promise<void> {
  try {
    // 1. Obtain MediaStream
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // @ts-expect-error chromeMediaSource is a Chrome-specific constraint
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    const audioTracks = mediaStream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error("no audio tracks available on captured stream");
    }
    console.log("[offscreen] audio track obtained:", audioTracks[0].label);

    // 2. Connect to transcriber
    transcriber = new TranscriberClient({
      onSegment: onTranscriptSegment,
      onStateChange: onTranscriberState,
      onError: onTranscriberError,
    });

    await transcriber.connect();

    // 3. Send session.start
    const startMsg: TranscriptionSessionStartMessage = {
      type: "transcription.session.start",
      sessionId: sessionId!,
      source: {
        type: "tab_audio",
      },
      audio: {
        mimeType: "audio/webm;codecs=opus",
        timesliceMs: 1000,
      },
      options: {
        language: "auto",
        interim: true,
      },
    };
    transcriber.sendSessionStart(startMsg);

    // 4. Start MediaRecorder
    captureStartTime = Date.now();
    mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 64000,
    });

    mediaRecorder.ondataavailable = async (event: BlobEvent) => {
      if (event.data.size === 0) return;

      const timestampMs = Date.now();
      const sizeBytes = event.data.size;

      // Send chunk metadata to service worker (for side panel display)
      chrome.runtime.sendMessage({
        type: "audio.chunk.metadata",
        sessionId,
        chunkIndex,
        sizeBytes,
        timestampMs,
      }).catch(() => {});

      // Send to transcriber: JSON metadata + binary audio
      if (transcriber) {
        try {
          const binary = await event.data.arrayBuffer();
          const meta: TranscriptionAudioChunkMessage = {
            type: "transcription.audio.chunk",
            sessionId: sessionId!,
            chunkIndex,
            timestampMs,
            mimeType: "audio/webm;codecs=opus",
          };
          transcriber.sendAudioChunk(meta, binary);
        } catch (err) {
          console.warn("[offscreen] failed to send audio chunk to transcriber:", err);
        }
      }

      console.log(`[offscreen] chunk #${chunkIndex} | ${sizeBytes} bytes`);
      chunkIndex++;
    };

    mediaRecorder.onerror = (event: Event) => {
      console.error("[offscreen] MediaRecorder error:", event);
    };

    mediaRecorder.start(1000);
    console.log("[offscreen] MediaRecorder started, chunk interval: 1000ms");
  } catch (err) {
    console.error("[offscreen] failed to start capture:", err);
    chrome.runtime.sendMessage({
      type: "capture.state",
      status: "error",
      error: String(err),
    }).catch(() => {});
  }
}

// --- Teardown ---

let stopResolveWait: (() => void) | null = null;

async function stopCapture(): Promise<void> {
  // 1. Stop MediaRecorder
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    console.log("[offscreen] MediaRecorder stopped");
  }

  // 2. Send session.stop to transcriber
  if (transcriber && sessionId) {
    const stopMsg: TranscriptionSessionStopMessage = {
      type: "transcription.session.stop",
      sessionId,
      reason: "user_stop",
    };
    transcriber.sendSessionStop(stopMsg);

    // Wait for the final transcript segment before disconnecting.
    // The server needs time to process all accumulated audio chunks
    // and send back the transcription result.
    await new Promise<void>((resolve) => {
      stopResolveWait = resolve;
      // Safety timeout: disconnect after 20s even if no segment received
      setTimeout(() => {
        if (stopResolveWait) {
          console.warn("[offscreen] timeout waiting for final transcript");
          stopResolveWait();
          stopResolveWait = null;
        }
      }, 20000);
    });
  }

  // 3. Disconnect transcriber
  if (transcriber) {
    transcriber.disconnect();
    transcriber = null;
    console.log("[offscreen] transcriber disconnected");
  }

  // 4. Stop all media tracks
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    console.log("[offscreen] media tracks released");
  }

  mediaRecorder = null;
  sessionId = null;
  chunkIndex = 0;
}

// --- Message handling ---

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "offscreen.start") {
    sessionId = message.sessionId as string;
    chunkIndex = 0;
    startCapture(message.streamId as string);
    return false;
  }

  if (message.type === "offscreen.stop") {
    stopCapture();
    return false;
  }

  return false;
});

console.log("[offscreen] Kotomi offscreen document ready");
