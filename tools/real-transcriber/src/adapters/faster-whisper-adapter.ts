// Faster-Whisper ASR adapter — calls a local Python HTTP service running faster-whisper.
//
// Architecture:
//   Node WebSocket server → FasterWhisperAdapter → ffmpeg (convert) → Python HTTP service
//
// Environment variables:
//   WHISPER_SERVICE_URL — HTTP endpoint of the Python ASR service (default: http://127.0.0.1:8766)
//   WHISPER_MODEL       — faster-whisper model size (default: "small", passed to Python service)

import { spawn } from "child_process";
import { unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import type { ASRAdapter, ASRResult } from "../asr-adapter";

const WHISPER_SERVICE_URL = process.env.WHISPER_SERVICE_URL ?? "http://127.0.0.1:8766";

export class FasterWhisperAdapter implements ASRAdapter {
  readonly name = "faster-whisper";
  private initialized = false;

  async initialize(): Promise<void> {
    // Check that the Python service is reachable
    try {
      const resp = await fetch(`${WHISPER_SERVICE_URL}/v1/health`);
      if (!resp.ok) {
        throw new Error(`health check failed: ${resp.status}`);
      }
      const body = await resp.json();
      console.log(`[faster-whisper] service healthy: model=${body.model}, device=${body.device}`);
      this.initialized = true;
    } catch (err) {
      throw new Error(
        `Cannot reach faster-whisper service at ${WHISPER_SERVICE_URL}. ` +
        `Start it with: cd tools/real-transcriber/python && python asr_service.py\n` +
        `Error: ${err}`,
      );
    }
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<ASRResult> {
    if (!this.initialized) {
      throw new Error("FasterWhisperAdapter not initialized");
    }

    // Convert webm/opus → 16kHz mono WAV via ffmpeg
    const wavPath = join(tmpdir(), `kotomi-asr-${randomUUID()}.wav`);

    try {
      await this.convertToWav(audioBuffer, wavPath);

      // Read the WAV file and send to Python service
      const { readFile } = await import("fs/promises");
      const wavData = await readFile(wavPath);

      const formData = new FormData();
      formData.append("audio", new Blob([wavData], { type: "audio/wav" }), "chunk.wav");

      const resp = await fetch(`${WHISPER_SERVICE_URL}/v1/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`ASR service returned ${resp.status}: ${errBody}`);
      }

      const result = await resp.json();
      console.log(`[faster-whisper] transcription: "${result.text}" (confidence: ${result.confidence ?? "N/A"})`);

      return {
        text: result.text ?? "",
        confidence: result.confidence,
      };
    } finally {
      // Clean up temp file
      unlink(wavPath).catch(() => {});
    }
  }

  async shutdown(): Promise<void> {
    console.log("[faster-whisper] shutdown (Python service continues running)");
  }

  /**
   * Convert audio/webm;codecs=opus to 16kHz mono WAV using ffmpeg.
   */
  private convertToWav(inputBuffer: Buffer, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-f", "webm",          // Input format: webm container
        "-i", "pipe:0",         // Read from stdin
        "-ar", "16000",         // 16kHz sample rate
        "-ac", "1",             // Mono
        "-sample_fmt", "s16",   // 16-bit PCM
        "-y",                   // Overwrite output
        outputPath,
      ], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stderr = "";

      ffmpeg.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-200)}`));
        }
      });

      ffmpeg.on("error", (err) => {
        reject(new Error(`ffmpeg spawn failed: ${err.message}. Is ffmpeg installed?`));
      });

      // Write input buffer to stdin
      ffmpeg.stdin.write(inputBuffer);
      ffmpeg.stdin.end();
    });
  }
}
