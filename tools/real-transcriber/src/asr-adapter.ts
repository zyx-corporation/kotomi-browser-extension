// ASR Adapter interface — defines the contract between the WebSocket protocol server
// and the actual speech recognition backend.
//
// Implementations:
//   - MockAdapter: returns mock text for development (no Python/ASR dependency)
//   - FasterWhisperAdapter: calls a local Python faster-whisper HTTP service

export interface ASRResult {
  text: string;
  confidence?: number;
}

export interface ASRAdapter {
  /** Human-readable name for logging and status messages */
  readonly name: string;

  /** One-time initialization (load model, start child process, etc.) */
  initialize(): Promise<void>;

  /**
   * Transcribe an audio buffer.
   * @param audioBuffer - Raw audio data (the adapter is responsible for format conversion)
   * @param mimeType - MIME type of the audio buffer (e.g., "audio/webm;codecs=opus")
   * @returns Transcription result with text and optional confidence score
   */
  transcribe(audioBuffer: Buffer, mimeType: string): Promise<ASRResult>;

  /** Clean shutdown (release model, stop child process, etc.) */
  shutdown(): Promise<void>;
}
