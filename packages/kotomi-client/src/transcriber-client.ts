// Transcriber client — WebSocket connection to the local Kotomi transcriber.

import type {
  TranscriptSessionStart,
  AudioChunkMessage,
  TranscriptSegment,
} from "../../../apps/extension/src/shared/types";

export class TranscriberClient {
  private ws: WebSocket | null = null;
  private url: string;

  constructor(url: string = "ws://localhost:8080") {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
    });
  }

  sendSessionStart(message: TranscriptSessionStart): void {
    this.send(message);
  }

  sendAudioChunk(message: AudioChunkMessage): void {
    this.send(message);
  }

  onTranscriptSegment(callback: (segment: TranscriptSegment) => void): void {
    if (!this.ws) return;
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "transcript.segment") {
        callback(data as TranscriptSegment);
      }
    };
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  private send(message: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}
