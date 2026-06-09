// Mock ASR adapter — returns deterministic mock transcript text.
// Used when TRANSCRIBER_BACKEND=mock or when real ASR dependencies are unavailable.

import type { ASRAdapter, ASRResult } from "../asr-adapter";

const MOCK_TEXTS = [
  "これは Kotomi の文字起こしテストです。",
  "現在タブの音声を取得しています。",
  "ブラウザ拡張から WebSocket 経由で音声チャンクを送信しています。",
  "このテストメッセージは mock transcriber によって生成されています。",
  "実際の ASR エンジンに置き換えることで、本格的な文字起こしが可能になります。",
  "Kotomi はローカル環境で動作する文字起こしツールです。",
];

export class MockAdapter implements ASRAdapter {
  readonly name = "mock";
  private callIndex = 0;

  async initialize(): Promise<void> {
    console.log("[mock-adapter] initialized (no model loaded)");
  }

  async transcribe(_audioBuffer: Buffer, _mimeType: string): Promise<ASRResult> {
    const text = MOCK_TEXTS[this.callIndex % MOCK_TEXTS.length];
    this.callIndex++;
    console.log(`[mock-adapter] returning mock text: "${text}"`);
    return { text, confidence: 0.95 + Math.random() * 0.04 };
  }

  async shutdown(): Promise<void> {
    console.log("[mock-adapter] shutdown");
  }
}
