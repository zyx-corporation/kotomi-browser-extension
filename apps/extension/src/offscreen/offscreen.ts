// Offscreen document — hosts MediaRecorder for tab audio capture.
// - Receives "offscreen.start" with streamId from service worker
// - Obtains MediaStream via getUserMedia with chromeMediaSource constraints
// - Creates MediaRecorder with `audio/webm;codecs=opus`
// - Emits audio.chunk.metadata to service worker on each dataavailable event
// - Stops on "offscreen.stop"

let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let sessionId: string | null = null;
let chunkIndex = 0;

async function startCapture(streamId: string): Promise<void> {
  try {
    // Obtain the actual MediaStream from the stream ID
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

    // Verify we have audio tracks
    const audioTracks = mediaStream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error("no audio tracks available on captured stream");
    }
    console.log("[offscreen] audio track obtained:", audioTracks[0].label);

    // Create MediaRecorder
    mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 64000,
    });

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size === 0) return;

      const timestampMs = Date.now();
      const sizeBytes = event.data.size;

      // Emit chunk metadata to service worker
      chrome.runtime.sendMessage({
        type: "audio.chunk.metadata",
        sessionId,
        chunkIndex,
        sizeBytes,
        timestampMs,
      }).catch((err) => {
        console.warn("[offscreen] failed to send chunk metadata:", err);
      });

      console.log(
        `[offscreen] chunk #${chunkIndex} | ${sizeBytes} bytes`,
      );

      chunkIndex++;
    };

    mediaRecorder.onerror = (event: Event) => {
      console.error("[offscreen] MediaRecorder error:", event);
      chrome.runtime.sendMessage({
        type: "audio.chunk.metadata",
        sessionId,
        chunkIndex,
        sizeBytes: 0,
        timestampMs: Date.now(),
      });
    };

    // Start recording with 1-second chunks
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

function stopCapture(): void {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    console.log("[offscreen] MediaRecorder stopped");
  }

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
