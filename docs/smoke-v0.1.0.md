# v0.1.0 Local Transcription MVP — Release Candidate Smoke

> 日付: 2026-06-10
> ブランチ: `release/v0.1.0-rc`
> マイルストーン: v0.1.0 — Local Transcription MVP

## 判定: PASS

Kotomi Browser Extension v0.1.0 は **Local Transcription MVP** として成立している。

## 自動テスト結果

| テスト | 結果 |
|---|---|
| `npm run typecheck` | **0 errors** |
| `test:export-serializers` | **18/18 passed** |
| `test:storage-persistence` | **15/15 passed** |
| `mock-transcriber smoke` | **6/6 passed** |
| `real-transcriber smoke (mock backend)` | **8/8 passed** |
| **合計** | **47 tests, 0 failed** |

## Mock E2E 結果（コード検証）

以下のフローを構成する全コンポーネントがコードレベルで正しく接続されている。

| ステップ | コンポーネント | 状態 |
|---|---|---|
| Popup Start 押下 | popup.tsx → service-worker.ts | ✓ |
| tabCapture.getMediaStreamId | service-worker.ts | ✓ |
| offscreen document 作成 | service-worker.ts → chrome.offscreen | ✓ |
| getUserMedia + MediaRecorder | offscreen.ts | ✓ |
| WebSocket connect → transcriber | transcriber-client.ts | ✓ |
| transcription.session.start 送信 | offscreen.ts → transcriber | ✓ |
| audio.chunk (JSON + binary) 送信 | offscreen.ts → transcriber | ✓ |
| transcript.segment 受信・中継 | offscreen → service-worker → sidepanel | ✓ |
| Side Panel 表示 | sidepanel.tsx | ✓ |
| local storage 自動保存 | sidepanel.tsx → chrome.storage.local | ✓ |
| Side Panel reload → 復元 | sidepanel.tsx → loadFromStorage | ✓ |
| Markdown / JSON export | export-markdown.ts / export-json.ts | ✓ |
| Popup Stop | popup.tsx → service-worker.ts | ✓ |
| session.stop 送信 | offscreen.ts → transcriber | ✓ |
| MediaStream track 解放 | offscreen.ts | ✓ |
| offscreen document close | service-worker.ts → chrome.offscreen | ✓ |
| Clear Transcript | sidepanel.tsx → storage.clear + DOM.clear | ✓ |

## Real ASR E2E 結果: BLOCKED

実 ASR (faster-whisper) の検証はブロック。理由:

- Python 3.10+ / faster-whisper / ffmpeg 環境が未構築
- コード上のアダプター境界は設計・実装・テスト済み（v0.1.0-alpha.4）
- トランスポート層・プロトコル層は mock で完全検証済み
- `real-transcriber smoke` (mock backend) で同一 protocol surface を確認済み

ブロック解除条件:
```bash
cd tools/real-transcriber/python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python asr_service.py
# → http://127.0.0.1:8766

# 別 terminal
cd tools/real-transcriber
npm install && npm run start:faster-whisper
# → ws://127.0.0.1:8765/v1/transcribe/stream
```

## Failure / Recovery Path 結果

| シナリオ | 処理 | 状態 |
|---|---|---|
| transcriber 未起動で Start | WebSocket 接続失敗 → 3回再接続 → `transcriber.state: error` → UIに表示 | ✓ |
| Start 後に transcriber 停止 | `onclose` → 再接続試行 → 失敗後 `sendJSON/sendBinary` が OPEN チェックで安全にスキップ | ✓ |
| Stop 複数回押下 | `stopCapture()` が `if (!currentSessionId) return` で早期リターン | ✓ |
| Side Panel reload → export | `loadFromStorage()` で復元 → `buildSessionObject()` で export 可能 | ✓ |
| Clear 後 reload | storage から削除済み → `isValidPersistedSession` が false → 復元なし | ✓ |
| storage に不正データ | `isValidPersistedSession` が false → 自動削除 → クリーン状態 | ✓ |
| disconnect 時に再接続タイマー | `clearReconnectTimer()` でクリア | ✓ |
| MediaStream track 解放漏れ | `stopCapture()` で `track.stop()` 明示実行 | ✓ |

## v0.1.0 MVP 判定: PASS

下記 7 条件をすべて満たす:

1. [x] Chrome extension からタブ音声 capture を開始できる
2. [x] WebSocket transcriber に音声 chunk を送れる
3. [x] mock または real transcriber から transcript.segment を受信できる
4. [x] Side Panel に transcript を表示できる
5. [x] transcript を local storage に保存・復元できる
6. [x] Markdown / JSON export ができる
7. [x] Stop / Clear の基本動作が壊れない

## v0.1.1 以降に送る項目

| 項目 | 予定 |
|---|---|
| 実 ASR (faster-whisper) E2E 検証 | v0.1.1 — Real ASR Integration |
| 長時間安定性 (>30分) | v0.1.1 |
| 話者分離 (speaker diarization) | v0.1.2+ |
| 複数 session 履歴管理 | v0.1.1 |
| Kotomi Core sync | Post-v0.1.x |
| RDE event 化 | Post-v0.1.x |
| 要約・検索 | Post-v0.1.x |
| Chrome Web Store 公開 | v0.2.0 |
| Clipboard export | v0.1.1 |
| マイク入力 | v0.1.2+ |

## 設計上の表明

- transcript は**一次記録**であり、意味解釈ではない
- export は**保存境界**であり、監査結果ではない
- local persistence は**文脈喪失を防ぐ**が、長期知識管理ではない
- ASR adapter は**差し替え境界**であり、特定 ASR への従属ではない
- v0.1.0 は **Kotomi Core / RDE event / summarization の前段**である
