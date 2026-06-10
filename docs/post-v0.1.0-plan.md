# Post-v0.1.0 Plan

> v0.1.0 完了後、v0.1.1 以降で順次対応する項目。

## v0.1.1 Candidate

### ~~Real ASR E2E Verification~~ ✅ UNBLOCKED (2026-06-11)
- [x] Python 3.12 / faster-whisper 1.2.1 環境を構築
- [x] 実音声 (日本語) からの transcript.segment 受信を確認
- [x] ffmpeg 変換パイプラインの実環境動作確認 (webm/opus → WAV)
- [x] E2E 自動テスト 10/10 パス (tools/real-transcriber/tests/real-asr-e2e.test.ts)
- [ ] CPU 推論のレイテンシ計測 (v0.1.1 後続)
- [ ] 実運用 CHUNKS_PER_SEGMENT の調整 (v0.1.1 後続)
- [ ] WebM チャンク結合の実運用検証 (MediaRecorder timeslice との互換性)

詳細: [docs/smoke-v0.1.1-real-asr.md](./smoke-v0.1.1-real-asr.md)

### Session History / Session List
- `chrome.storage.local` に複数 session を保存
- Side Panel に session list UI
- session の選択・削除・export
- storage quota 監視と古い session の自動クリーンアップ

### Long-Running Stability Smoke
- 30分以上の連続 capture テスト
- memory leak の有無確認
- MediaRecorder chunk の長期安定性
- WebSocket 再接続の長期信頼性

### Basic Transcript Search
- Side Panel 内の簡易テキスト検索
- segment 単位でのハイライト

## v0.1.2 Candidate

### Speaker Diarization
- ASR adapter に speaker label の受信機能追加
- 表示・export での speaker 表示

### Microphone Capture
- `captureSource: "microphone"` 対応
- タブ音声とマイク音声の切替 UI

### Clipboard Export
- Markdown / JSON のクリップボードコピー

## v0.2.0 Candidate

### Chrome Web Store Publication
- 審査基準への適合確認
- privacy policy / ストア掲載文の整備
- packaged extension のビルド

### Kotomi Core Sync Design
- Kotomi Core への transcript 送信プロトコル設計
- ローカル保存と Core 保存の同期方針

### RDE Event Boundary Design
- transcript.segment → RDE event への変換ルール設計
- timestamp / speaker / text のマッピング
- 監査用 metadata の付与

### URL-based Audio Capture (proposed 2026-06-11)
- `chrome.tabCapture` はタブ音声をミュートする副作用がある
- タブの現在 URL から直接音声ソースを取得するオプションの検討
- 例: `<audio>` / `<video>` 要素からの MediaStream 取得、または `chrome.webRequest` + 音声URL の直接取得
- 現状の `tabCapture` と併用できる選択式 UI が望ましい

## Non-Roadmap（現段階で意図的に除外）

- クラウド ASR 連携
- 自動録音
- ページ本文の content script 取得
- 意味解釈・自動要約
- 機械学習ベースのノイズ除去
- マルチブラウザ対応（Firefox, Safari）
- アカウント・認証機能
