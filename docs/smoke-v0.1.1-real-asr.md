# v0.1.1 Real ASR E2E — 検証レポート

> 実施日: 2026-06-11
> 目的: v0.1.0 で BLOCKED だった Real ASR (faster-whisper) の E2E 検証を完了する

## 実行環境

| 項目 | 値 |
|---|---|
| OS | macOS 25.5.0 (x86_64) |
| Python | 3.12.13 (Homebrew, `/usr/local/opt/python@3.12/bin/python3.12`) |
| faster-whisper | 1.2.1 |
| ctranslate2 | 4.8.0 |
| onnxruntime | 1.23.2 |
| flask | 3.1.3 |
| ffmpeg | 8.1.1 |
| Node.js | v26.3.0 |

> **注意**: Python 3.13+ では onnxruntime のホイールが提供されておらず、faster-whisper がインストール不可。
> 本プロジェクトでは Python 3.10〜3.12 を推奨。

## 検証結果サマリ

| 項目 | 結果 |
|---|---|
| Python ASR サービス起動 | **PASS** |
| faster-whisper モデルロード (`small`, cpu, int8) | **PASS** |
| HTTP `/v1/health` | **PASS** |
| HTTP `/v1/transcribe` (日本語音声) | **PASS** — "こんにちは、これはテストです。" confidence: 0.7873 |
| Node WebSocket サーバー起動 | **PASS** |
| WebSocket `/v1/transcribe/stream` 接続 | **PASS** |
| `transcription.session.start` → `transcriber.state` | **PASS** |
| `transcription.audio.chunk` (JSON + binary) | **PASS** |
| ffmpeg webm→wav 変換 | **PASS** |
| faster-whisper 文字起こし | **PASS** |
| `transcript.segment` 受信 | **PASS** |
| `transcription.session.stop` | **PASS** |
| エラーハンドリング | **PASS** |
| **E2E 自動テスト** | **10/10 PASS** |

## 検証手順

### 1. 前提条件

```bash
# Python 3.12 が必要 (3.13+ では不可)
brew install python@3.12
```

### 2. Python ASR サービスのセットアップと起動

```bash
cd tools/real-transcriber/python

# virtualenv 作成 (初回のみ)
/usr/local/opt/python@3.12/bin/python3.12 -m venv .venv
source .venv/bin/activate

# 依存関係インストール (初回のみ)
pip install -r requirements.txt

# サービス起動
python asr_service.py
# → http://127.0.0.1:8766
# ※初回起動時に faster-whisper モデル (~500MB for small) が自動ダウンロードされる
```

### 3. Node WebSocket サーバーの起動

```bash
cd tools/real-transcriber
npm install
TRANSCRIBER_BACKEND=faster-whisper npm start
# → ws://127.0.0.1:8765/v1/transcribe/stream
```

### 4. E2E テストの実行

```bash
# テスト用音声ファイルの生成
say -o /tmp/test.aiff "こんにちは、これはテストです。"
ffmpeg -y -i /tmp/test.aiff -c:a libopus -b:a 64k -ar 48000 -ac 1 /tmp/kotomi-test-speech.webm

# テスト実行
npx tsx tools/real-transcriber/tests/real-asr-e2e.test.ts
```

期待される出力:
```
Kotomi Real ASR — E2E Test (faster-whisper backend)

  ✓ Test audio file exists
  ✓ WebSocket connect
  ✓ Send session.start
  ✓ Receive transcriber.state
  ✓ Send audio chunk
  ✓ No transcriber errors
  ✓ Receive transcript segments — "こんにちは、これはテストです。" (confidence: 0.7873)
  ✓ Japanese speech recognized
  ✓ Send session.stop
  ✓ WebSocket disconnect

Results: 10 passed, 0 failed, 10 total
All E2E tests passed ✓
```

## アーキテクチャ確認

```
Browser Extension (WebSocket)
       │
       ▼  ws://127.0.0.1:8765/v1/transcribe/stream
┌──────────────────────────────┐
│  Node WebSocket Server       │  ← processBatch (CHUNKS_PER_SEGMENT=1)
│  FasterWhisperAdapter        │
│       │                      │
│       ▼                      │
│  ffmpeg (webm/opus → WAV)    │
│       │                      │
│       ▼  HTTP POST           │
│  Python ASR Service          │  ← http://127.0.0.1:8766
│  faster-whisper (small)      │
└──────────────────────────────┘
```

## 既知の制限

### Python バージョン制約
- faster-whisper は onnxruntime に依存し、onnxruntime は Python 3.10〜3.12 のみホイール提供
- Python 3.13+ では `pip install -r requirements.txt` が失敗する
- 回避策: Homebrew で `python@3.12` をインストールし、明示的に venv を作成する

### CPU 推論のレイテンシ
- small モデル + CPU で ~2秒の音声に対し数秒の処理時間
- 実運用では `CHUNKS_PER_SEGMENT` を調整してバッファリングとレイテンシのバランスを取る必要がある

### WebM チャンク結合
- テストでは完全な WebM ファイルを単一チャンクで送信した
- 実際の Chrome 拡張では MediaRecorder が timeslice ごとに WebM フラグメントを生成する
- それらを単純に Buffer.concat すると不正な WebM になる可能性がある (未検証)
- 対処候補: 各チャンクを個別に ffmpeg で変換し、WAV 側で結合する
- または 1回の capture 全体を単一チャンクとして扱う

### 初回モデルダウンロード
- faster-whisper small モデル (~500MB) が初回起動時に自動ダウンロードされる
- Hugging Face Hub からダウンロード (認証不要だがレート制限あり)
- `HF_TOKEN` 環境変数を設定すると高速化される

## 自動テスト状況

| テストスイート | テスト数 | 結果 | 備考 |
|---|---|---|---|
| typecheck | - | PASS | |
| export-serializers | 18 | 18/18 PASS | |
| storage-persistence | 15 | 15/15 PASS | |
| mock-transcriber smoke | 6 | 6/6 PASS | mock サーバー起動必要 |
| real-transcriber smoke (mock backend) | 8 | 6/8 PASS | fake audio → エラーは期待通り (2件失敗) |
| **Real ASR E2E** | **10** | **10/10 PASS** | Python ASR + Node サーバー起動必要 |

## 次に自動化すべきポイント

1. **Python 環境の自動セットアップ**: `brew install python@3.12` と venv 作成を自動化
2. **テスト用音声ファイルの自動生成**: `say` コマンドが macOS 依存のため、クロスプラットフォーム対応が必要
3. **Real ASR E2E テストの CI 統合**: 現在は手動実行のみ。CI では Python 環境の構築がボトルネック
4. **Real ASR E2E smoke test (実音声)**: 現在の smoke test は偽データで、ffmpeg エラーを期待する設計。実音声を使うテストに置き換え可能

## Extension Real ASR Smoke (2026-06-11)

Chrome 拡張を実際にロードし、YouTube 音声タブから real-transcriber 経由の文字起こしを検証。

### 結果: PASS

| 項目 | 結果 |
|---|---|
| 拡張ビルド → Chrome ロード | PASS |
| tabCapture → MediaRecorder → WebSocket | PASS |
| WebM チャンク連結 (Buffer.concat) | PASS |
| ffmpeg webm→WAV 変換 | PASS |
| faster-whisper small/CPU/int8 文字起こし | PASS |
| **transcript.segment → sidepanel 表示** | **PASS** |
| タイムスタンプ・信頼度表示 | PASS |
| chrome.storage.local 自動保存 | PASS |
| Export Markdown / JSON | PASS |

### 発見された不良と修正

| 不良 | 修正 |
|---|---|
| WebM チャンクの個別処理で ffmpeg エラー (EBML ヘッダー欠落) | `processBatch` で全チャンクを蓄積し `session.stop` 時一括処理 |
| `processBatch` のレースコンディション | 排他ロック (`session.processing`) + バッファのスナップショット |
| Stop 後に transcript が sidepanel に届かない | offscreen `stopCapture()` で transcript 受信を待機 (20s timeout) / service worker で offscreen close を 15s 遅延 |
| ポップアップ再表示で Chunks カウンタがリセット | sidepanel の `capture.state` ハンドラを同一セッションではリセットしないよう修正 |
| Stop 後にポップアップが「Recording…」のまま | `broadcastState("idle")` を待機前に移動 |

### Known Issue (v0.1.2 送り)

- サイドパネル未表示時に Start を押すとポップアップが閉じる (Chrome `sidePanel.open()` の標準動作)
- `tabCapture` によりタブ音声がミュートされる (Chrome の制限事項)
