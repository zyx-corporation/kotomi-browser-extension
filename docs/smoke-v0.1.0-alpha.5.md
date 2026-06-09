# Markdown / JSON Export Smoke (v0.1.0-alpha.5)

> 日付: 2026-06-10
> ブランチ: `feature/export-markdown-json`
> マイルストーン: v0.1.0-alpha.5 — Markdown / JSON Export

## 確認できたこと

### 1. シリアライザー

- `packages/transcript-core/src/export-markdown.ts` — 純粋関数 `exportMarkdown(session, options?)`
- `packages/transcript-core/src/export-json.ts` — 純粋関数 `exportJSON(session, options?)`
- 両シリアライザーは DOM / Chrome API に依存しない

### 2. Markdown Export の仕様

- メタデータブロック: Session ID, Title, URL, Source, Capture Mode, Transcriber, 日時
- 本文: `[MM:SS-MM:SS] テキスト *(conf: 97%)*` 形式（1時間超は `[HH:MM:SS]`）
- speaker がある場合: `[MM:SS-MM:SS] **Speaker:** テキスト`
- デフォルトでは interim segment を除外 (`includeInterim: true` で含められる）
- 空セッションは `_(no transcript segments)_` を表示
- confidence がない場合は注記なし

### 3. JSON Export の仕様

- `schemaVersion: "0.1.0"`
- `session` オブジェクト: メタデータ（segmentCount, finalSegmentCount 含む）
- `segments` 配列: 各フィールドを完全保持（segmentId, startMs, endMs, text, isFinal, confidence, speaker, receivedAt）
- `pretty: true`（デフォルト）でインデント整形、`false` でコンパクト
- interim segment はデフォルト除外（`includeInterim: true` で含められる）
- receivedAt は ISO 8601 文字列

### 4. シリアライザーテスト

```
Markdown Export:   7/7 passed
JSON Export:       4/4 passed
Transcript Model:  3/3 passed
Edge Cases:        4/4 passed
─────────────────────────
Total:            18/18 passed
```

テスト項目:
- 空セッション
- timestamp 付きセグメント
- confidence 注記
- speaker label
- interim 除外（MD/JSON 共通）
- interim 含むオプション
- 長時間タイムスタンプ
- 全セグメントフィールド保持（JSON）
- pretty/compact 切替
- upsertSegment の置換/追加
- finalOnly フィルタ
- ゼロ duration
- confidence undefined 時の省略
- speaker null 時の省略
- 特殊文字を含むテキスト

### 5. Side Panel UI

- Export Markdown / Export JSON / Clear ボタンを追加
- transcript が空の場合は 3 ボタンとも disabled
- segment が 1 つ以上あると有効化
- interim→final の更新時に既存行を置換（重複表示しない）
- ダウンロードファイル名: `kotomi-transcript-YYYYMMDD-HHMM-{shortId}.{md|json}`
- Clear は `confirm()` で誤操作防止

### 6. Track Record

| テスト | 結果 |
|---|---|
| `npm run typecheck` | 0 errors |
| `serializer tests` | 18/18 passed |
| `mock-transcriber smoke` | 維持（変更なし） |
| `real-transcriber smoke` | 維持（変更なし） |

## 確認できなかったこと

| 項目 | 理由 |
|---|---|
| 大量 segment（>1000件）の export パフォーマンス | テスト未実施 |
| 特殊文字（emoji, RTL等）の完全性 | 軽度テストのみ |
| Clipboard export | v0.1.0 スコープ外 |
| local storage 永続化 | v0.1.0 スコープ外 |
| transcript の Kotomi Core 連携 | Post-v0.1.0 |
| 複数セッションの管理 | Post-v0.1.0 |

## Interim / Final の扱い

- デフォルトでは export 対象は **final segment のみ**
- `includeInterim: true` オプションで interim も含められる
- Side Panel 上では interim→final の更新時に同一 segmentId の行を置換
- これにより同一文が重複表示されない
- upsertSegment がこの置換ロジックを提供

## Speaker / Confidence の扱い

- `speaker` は null 許容。値がある場合のみ Markdown に `**Speaker:**` ラベルを出力
- `confidence` は 0-1 の数値。値がある場合のみ `(conf: XX%)` を注記
- JSON では両フィールドとも常に出力（null / undefined のまま）

## 既知の制限

- Markdown のテキスト内特殊文字（`|`, `[`, `]`等）のエスケープは未実装
- 巨大な transcript（>10,000行）の Markdown は可読性が低下
- ファイル名の sessionId は先頭 6 文字のみ
- Clear 後の undo 不可（将来実装候補）

## 設計上の位置づけ

v0.1.0-alpha.5 は「便利機能」ではなく、**Kotomi における文脈保存の最初のプロトコル**。

- Markdown は人間可読の一次記録
- JSON は機械可読の監査・再処理形式
- どちらも ASR の誤認識を含めて元記録として保存する
- 要約・解釈・修正は行わない
- 将来の要約・検索・RDE 監査・意味変化検証・Kotomi Core 連携の入力になる

capture → transcribe → export が揃い、v0.1.0 MVP の輪郭が確立した。
