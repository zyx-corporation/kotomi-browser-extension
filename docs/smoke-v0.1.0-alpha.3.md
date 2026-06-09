# WebSocket Transport Smoke (v0.1.0-alpha.3)

> 日付: 2026-06-10
> ブランチ: `feature/transcriber-websocket`
> マイルストーン: v0.1.0-alpha.3 — WebSocket Transport Smoke

## 確認できたこと

### 1. Build / Typecheck

- `tsc --noEmit` が 0 errors で通過
- TypeScript 6.0.3 + `@types/chrome` で全ファイルの型整合性を確認
- tsconfig.json を追加（`strict: true`, module: ES2022, moduleResolution: bundler）

### 2. Mock Transcriber 起動確認

- `tools/mock-transcriber` の `npm install` が正常終了
- WebSocket server が `ws://127.0.0.1:8765/v1/transcribe/stream` で listen することを確認
- smoke test にて以下を検証:
  - WebSocket 接続 ✓
  - `transcription.session.start` 送信 ✓
  - `transcriber.state: connected` 受信 ✓
  - JSON + binary audio chunk 6 回送信 ✓
  - 3 chunk ごとに `transcript.segment` 受信（計2件） ✓
  - `transcription.session.stop` 送信 ✓
  - WebSocket 切断 ✓

### 3. Protocol 一貫性

- `docs/transcription-protocol.md` の全メッセージ型が `shared/types.ts` の型定義と一致
- JSON frame → binary frame の順序付けが実装・ドキュメント間で一貫
- `sessionId` が全メッセージで正しく伝播

### 4. Failure Path（コードレビューで確認）

| シナリオ | 処理 | 状態 |
|---|---|---|
| transcriber 未起動時に Start | WebSocket 接続失敗 → 3 回再接続 → `transcriber.state: error` が UI に通知される | ✓ |
| 再接続の上限 | `MAX_RECONNECT_ATTEMPTS = 3` で停止 | ✓ |
| Stop 時に未接続 | `sendJSON/sendBinary` が OPEN 状態をチェック、未接続時は警告ログのみで例外なし | ✓ |
| disconnect 時に再接続タイマーが残る | `clearReconnectTimer()` でタイマーをクリア（今回 hardening で追加） | ✓ |
| MediaRecorder の track 解放 | `stopCapture()` で `stream.getTracks().forEach(track.stop())` を実行 | ✓ |
| offscreen document の close | service worker が `chrome.offscreen.closeDocument()` を実行 | ✓ |

### 5. Hardening 修正

- `TranscriberClient` に `reconnectTimerId` フィールドと `clearReconnectTimer()` メソッドを追加
- `disconnect()` 時に pending の再接続タイマーをクリア
- `connect()` 時に古いタイマーをクリア

## 未確認のこと

以下の項目はこのマイルストーンの範囲外であり、将来のマイルストーンで検証する。

| 項目 | 予定マイルストーン |
|---|---|
| 実 ASR（Whisper / faster-whisper）との統合 | v0.1.0-alpha.4 — Real ASR Adapter |
| 話者分離（speaker diarization） | Post-v0.1.0 |
| 長時間（>30分）の安定性 | v0.1.0-alpha.4 |
| ネットワーク断後の完全復旧（音声ロスなし） | Post-v0.1.0 |
| 音声フォーマット互換性（Opus 以外） | v0.1.0-alpha.4 |
| Chrome Web Store 審査基準への適合 | v0.1.0 |
| メモリ使用量の長期安定性 | v0.1.0 |
| Content script によるページ本文取得 | non-goal（v0.1 では実装しない） |
| クラウド送信 | non-goal（設計方針: localhost のみ） |
| バックグラウンド録音 | non-goal（設計方針: 明示操作のみ） |

## 手動確認手順（Chrome Extension）

```bash
# 1. mock transcriber を起動
cd tools/mock-transcriber && npm start

# 2. Chrome で拡張を読み込む
# chrome://extensions → "Load unpacked" → apps/extension/ を選択

# 3. 確認項目
# - [ ] Popup の Start ボタンがクリック可能
# - [ ] Start 押下後、Side Panel に Status: capturing が表示される
# - [ ] Side Panel に Chunks: N | Transcriber: connected が表示される
# - [ ] 3 chunk ごとに transcript segment が Side Panel に表示される
# - [ ] Stop 押下後、Status: idle に戻る
# - [ ] Stop 後に chunk が増え続けない
```

## 結論

v0.1.0-alpha.3 の目標である「WebSocket transport の縦串確認」は達成。
文字起こしエンジンを接続できる通信・中継・表示基盤が成立している。
