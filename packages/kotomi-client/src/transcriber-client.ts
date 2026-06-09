// Transcriber client — WebSocket connection to the local Kotomi transcriber.
// - Connects to ws://127.0.0.1:8765/v1/transcribe/stream
// - Sends transcription.session.start, transcription.audio.chunk, transcription.session.stop
// - Sends binary audio chunks after JSON metadata
// - Receives transcript.segment and transcriber.error
// - Emits state changes via onStateChange callback

import type {
  TranscriptionSessionStartMessage,
  TranscriptionAudioChunkMessage,
  TranscriptionSessionStopMessage,
  TranscriptSegmentMessage,
  TranscriberErrorMessage,
  TranscriberStateMessage,
} from "../../../apps/extension/src/shared/types";

export type TranscriberState = TranscriberStateMessage["status"];

export interface TranscriberCallbacks {
  onSegment: (segment: TranscriptSegmentMessage) => void;
  onStateChange: (state: TranscriberState, message?: string) => void;
  onError: (error: TranscriberErrorMessage) => void;
}

const DEFAULT_URL = "ws://127.0.0.1:8765/v1/transcribe/stream";
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 3;

export class TranscriberClient {
  private ws: WebSocket | null = null;
  private url: string;
  private callbacks: TranscriberCallbacks;
  private reconnectAttempts = 0;
  private shouldReconnect = true;
  private reconnectTimerId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    callbacks: TranscriberCallbacks,
    url: string = DEFAULT_URL,
  ) {
    this.url = url;
    this.callbacks = callbacks;
  }

  // --- Connection ---

  connect(): Promise<void> {
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    return this.doConnect();
  }

  private doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.callbacks.onStateChange("connecting");

      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        this.callbacks.onStateChange("error", String(err));
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        console.log("[transcriber-client] WebSocket connected");
        this.callbacks.onStateChange("connected");
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onclose = (event) => {
        console.log("[transcriber-client] WebSocket closed:", event.code, event.reason);
        this.callbacks.onStateChange("disconnected", `code=${event.code}`);

        if (this.shouldReconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          console.log(
            `[transcriber-client] reconnecting (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})…`,
          );
          this.reconnectTimerId = setTimeout(() => this.doConnect().catch(() => {}), RECONNECT_DELAY_MS);
        }
      };

      this.ws.onerror = (_event) => {
        // onclose will fire after this
        console.warn("[transcriber-client] WebSocket error");
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string);

          if (data.type === "transcript.segment") {
            this.callbacks.onSegment(data as TranscriptSegmentMessage);
          } else if (data.type === "transcriber.error") {
            this.callbacks.onError(data as TranscriberErrorMessage);
            this.callbacks.onStateChange("error", (data as TranscriberErrorMessage).message);
          }
        } catch (err) {
          console.warn("[transcriber-client] failed to parse message:", err);
        }
      };
    });
  }

  // --- Session lifecycle ---

  sendSessionStart(message: TranscriptionSessionStartMessage): void {
    this.sendJSON(message);
  }

  sendAudioChunk(metadata: TranscriptionAudioChunkMessage, binary: ArrayBuffer): void {
    // Send JSON metadata first, then binary frame
    this.sendJSON(metadata);
    this.sendBinary(binary);
  }

  sendSessionStop(message: TranscriptionSessionStopMessage): void {
    this.sendJSON(message);
  }

  // --- Teardown ---

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, "client disconnect");
    }
    this.ws = null;
  }

  // --- Internals ---

  private clearReconnectTimer(): void {
    if (this.reconnectTimerId !== null) {
      clearTimeout(this.reconnectTimerId);
      this.reconnectTimerId = null;
    }
  }

  private sendJSON(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn("[transcriber-client] cannot send JSON: not connected");
    }
  }

  private sendBinary(data: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      console.warn("[transcriber-client] cannot send binary: not connected");
    }
  }
}
