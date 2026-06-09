# Real ASR Adapter Smoke (v0.1.0-alpha.4)

> 日付: 2026-06-10
> ブランチ: `feature/real-asr-adapter`
> マイルストーン: v0.1.0-alpha.4 — Real ASR Adapter Boundary

## 確認できたこと

### 1. Adapter Boundary

- `ASRAdapter` interface を定義（`asr-adapter.ts`）。3 メソッド: `initialize`, `transcribe`, `shutdown`
- `MockAdapter` 実装：依存ゼロで mock text を返す
- `FasterWhisperAdapter` 実装：ffmpeg で webm→WAV 変換し Python HTTP サービスに渡す
- 両 adapter が同一 interface を満たす

### 2. Protocol Surface

- real-transcriber の WebSocket サーバーは mock-transcriber と**同一の endpoint / protocol** を使用
- `ws://127.0.0.1:8765/v1/transcribe/stream`
- 同一のメッセージ型: `transcription.session.start`, `transcription.audio.chunk` (JSON + binary), `transcription.session.stop`
- 同一のレスポンス: `transcript.segment`, `transcriber.state`, `transcriber.error`

### 3. 設定の環境変数化

| 変数 | 既定値 | 目的 |
|---|---|---|
| `TRANSCRIBER_BACKEND` | `mock` | `mock` / `faster-whisper` 切替 |
| `TRANSCRIBER_PORT` | `8765` | WebSocket listen port |
| `CHUNKS_PER_SEGMENT` | `3` | chunk バッファリング数 |
| `WHISPER_SERVICE_URL` | `http://127.0.0.1:8766` | Python ASR サービス endpoint |
| `ASR_PORT` | `8766` | Python サービス port |
| `ASR_MODEL` | `small` | faster-whisper model size |
| `ASR_DEVICE` | `cpu` | `cpu` / `cuda` |
| `ASR_COMPUTE_TYPE` | `int8` | 量子化 |

### 4. Mock smoke test の維持

- `npm run typecheck` → 0 errors
- mock-transcriber (tools/mock-transcriber) は変更なし → 既存 smoke が引き続き通過
- real-transcriber mock backend の smoke も同一 protocol で通過

### 5. Audio 変換レイヤー

- MediaRecorder 出力: `audio/webm;codecs=opus`
- FasterWhisperAdapter が ffmpeg で 16kHz mono WAV に変換
- 変換失敗時は `transcriber.error` を返す
- 一時ファイルは処理後に必ず削除

### 6. エラー処理

- ASR adapter 初期化失敗時は mock に自動フォールバック
- ASR transcribe 失敗時は `transcriber.error` を WebSocket クライアントに返す
- Python サービス未起動時は明確なエラーメッセージ + 起動手順を表示
- ffmpeg 不在時は `ffmpeg spawn failed` エラーを返す

## 確認できなかったこと

以下の項目は実 ASR 環境が必要であり、今回はコード上の設計確認に留めた。

| 項目 | 理由 |
|---|---|
| faster-whisper 実モデルでの文字起こし精度 | Python deps / model download が必要 |
| CUDA GPU での推論速度 | GPU 環境未整備 |
| 長時間音声の安定性（>5分） | alpha.4 スコープ外 |
| ノイズ混じり音声の認識品質 | alpha.4 スコープ外 |
| 日本語以外の言語認識 | デフォルト日本語、切替未実装 |
| ffmpeg 変換の CPU 負荷 | ベンチマーク未実施 |

## ASR 精度上の制限

- `small` model を使用する場合、専門用語や固有名詞の認識精度は限定的
- CPU 推論（`int8`）の場合、1 chunk（3秒分）の処理に数秒かかる
- より高精度が必要な場合は `medium` / `large-v3` model + CUDA 環境を推奨
- 現在は逐次処理（バッチ 3 chunk 単位）。リアルタイム streaming は非対応
- VAD（Voice Activity Detection）を有効化しているが、BGM 付き音声では精度低下の可能性あり

## 依存関係

| 依存 | 要否 | 備考 |
|---|---|---|
| Node.js (v18+) | 必須 | WebSocket サーバー |
| `ws` npm package | 必須 | WebSocket 実装 |
| Python 3.10+ | faster-whisper 時のみ | ASR service |
| `faster-whisper` | faster-whisper 時のみ | ASR engine |
| `flask` | faster-whisper 時のみ | HTTP server |
| `ffmpeg` | faster-whisper 時のみ | audio 変換 |
| CUDA / GPU | 任意（推奨） | 推論高速化 |

## Transport Layer と ASR Adapter Layer の責務境界

```
┌─ Transport Layer ─────────────────┐
│  WebSocket protocol handler       │
│  - session lifecycle              │
│  - audio chunk buffering          │
│  - transcript segment routing     │
│  - state / error relay            │
└────────────┬─────────────────────┘
             │  ASRAdapter interface
             │
┌────────────┴─────────────────────┐
│  ASR Adapter Layer               │
│  - audio format conversion       │
│  - ASR engine invocation         │
│  - result normalization          │
│  (MockAdapter / FasterWhisper)   │
└──────────────────────────────────┘
```

- Transport layer は protocol 形状のみを規定する。ASR 実装には関知しない
- Adapter layer は audio → text 変換に専念する。session 管理や client routing は行わない
- `transcript.segment` は「認識結果」であり、「意味解釈」ではない
- 将来の diarization / summarization / RDE event 化は別層

## 既知の失敗パターン

| 症状 | 原因 | 対処 |
|---|---|---|
| `Cannot reach faster-whisper service` | Python service 未起動 | `python asr_service.py` を別 terminal で起動 |
| `ffmpeg spawn failed` | ffmpeg 未インストール | `brew install ffmpeg` (macOS) 等 |
| 初回 transcribe が遅い | モデル初回ロード中 | 2 回目以降は高速 |
| メモリ不足 | `small` model で ~2GB RAM 使用 | `base` / `tiny` model に変更 |

## マイルストーン位置づけ

v0.1.0-alpha.4 の勝利条件は**精度ではなく、差し替え可能な ASR 境界の確立**。
これにより、今後の ASR backend（Whisper, whisper.cpp, Kotomi Core ASR, クラウド ASR）を並列比較可能になる。
