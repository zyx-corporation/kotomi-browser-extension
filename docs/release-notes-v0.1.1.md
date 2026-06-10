# Kotomi Browser Extension — v0.1.1 Release Notes

> リリース日: 2026-06-11
> バージョン: v0.1.1 "Real ASR Validation"

## Summary

v0.1.1 は v0.1.0 の Real ASR ブロックを解消し、faster-whisper による実音声文字起こしパイプラインを完全に検証したリリースです。

v0.1.0 で完了していた WebSocket プロトコル / mock パイプラインに加え、Python 3.12 + faster-whisper + ffmpeg のフルスタックが実運用レベルの E2E で動作することを確認しました。

## What's New in v0.1.1

### Real ASR E2E (UNBLOCKED)

- **Python / faster-whisper 環境構築** — Python 3.12 + faster-whisper 1.2.1 + onnxruntime 1.23.2
- **WebM チャンク連結** — Chrome MediaRecorder の WebM timeslice を正しく連結し、ffmpeg で WAV 変換
- **全チャンク一括文字起こし** — レースコンディションを排他ロックで解消し、`session.stop` 時に全チャンクを一括処理
- **transcript.segment 表示** — sidepanel に実音声の文字起こし結果が表示されることを Chrome 拡張実ロードで確認
- **自動テスト** — `real-asr-e2e` テスト 10/10 パス（`npm run test:real-asr-e2e`）

### Chrome Extension Build

- **ビルドスクリプト** — `apps/extension/build.ts`（esbuild）で TypeScript をバンドル
- **ビルド出力** — `apps/extension/dist/` を Chrome に直接ロード可能
- **サイドパネル自動表示** — Start 時に `chrome.sidePanel.open()` を呼び出し

### Bug Fixes

- Stop 後に transcript が sidepanel に届かない問題を修正（WebSocket 切断タイミング）
- サイドパネルの Chunks カウンタが状態クエリでリセットされる問題を修正
- `processBatch` のレースコンディションを排他ロックで修正

## Test Results (2026-06-11)

| テスト | 結果 |
|---|---|
| typecheck | PASS |
| export-serializers | 18/18 PASS |
| storage-persistence | 15/15 PASS |
| mock-transcriber smoke | 6/6 PASS |
| real-asr-e2e | 10/10 PASS |
| **合計** | **49 tests, 0 failures** |
| Extension Real ASR Smoke (手動) | PASS |

## Known Limitations

- Python 3.13+ 非対応（onnxruntime ホイール未提供のため）
- `tabCapture` 使用中タブ音声がミュートされる（Chrome 制限）
- サイドパネル未表示時の Start でポップアップが閉じる（Chrome `sidePanel.open()` の挙動）
- CPU 推論レイテンシ未計測
- 長時間（30分以上）の安定性未検証
- Session History 未実装

## How to Use

### Prerequisites

```bash
# Python 3.12 が必要
brew install python@3.12

# Python 依存関係
cd tools/real-transcriber/python
/usr/local/opt/python@3.12/bin/python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Start Services

```bash
# Terminal 1: Python ASR
cd tools/real-transcriber/python
source .venv/bin/activate
python asr_service.py

# Terminal 2: Node WebSocket Server
cd tools/real-transcriber
npm install
TRANSCRIBER_BACKEND=faster-whisper npm start
```

### Load Extension

```bash
npm run build:extension
# → Load apps/extension/dist/ in chrome://extensions
```

## Upgrade from v0.1.0

Breaking changes: なし。mock パイプラインと同一の WebSocket エンドポイント・プロトコルを使用。

v0.1.0 のコードは全てそのまま動作します。Real ASR を使用する場合は上記 Python 環境のセットアップが必要です。

## v0.1.2 Planned

- `sidePanel.open()` UX 改善
- CPU 推論レイテンシ計測 + CHUNKS_PER_SEGMENT 調整
- 長時間安定性テスト（30分+）
- Session History / Session List
- 簡易テキスト検索
- URL から直接音声取得（`tabCapture` ミュート回避）

詳細: [docs/post-v0.1.0-plan.md](./post-v0.1.0-plan.md)
