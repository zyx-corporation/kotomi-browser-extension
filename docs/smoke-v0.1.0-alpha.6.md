# Local Session Persistence Smoke (v0.1.0-alpha.6)

> 日付: 2026-06-10
> ブランチ: `feature/local-persistence`
> マイルストーン: v0.1.0-alpha.6 — Local Session Persistence / Resume

## 確認できたこと

### 1. Storage シリアライザー

- `packages/transcript-core/src/storage.ts` — 純粋関数で Chrome API 非依存
- `serializeSession(session, createdAt?)` — TranscriptSession → PersistedSession
- `deserializeSession(data)` — PersistedSession → TranscriptSession
- `isValidPersistedSession(data)` — schemaVersion 検証 + 必須フィールド存在チェック
- `STORAGE_KEY = "kotomi.transcript.currentSession"`
- `STORAGE_SCHEMA_VERSION = "0.1.0"`
- `PersistedSession` に `createdAt` / `updatedAt` / `schemaVersion` を追加

### 2. 保存する情報

| フィールド | 内容 |
|---|---|
| `schemaVersion` | `"0.1.0"` |
| `sessionId` | UUID |
| `createdAt` | セッション作成時刻 (epoch ms) |
| `updatedAt` | 最終更新時刻 (epoch ms) |
| `metadata` | url, title, startedAt, endedAt, captureMode, transcriberState, source |
| `segments` | 全 StoredSegment（segmentId, startMs, endMs, text, isFinal, confidence, speaker, receivedAt） |

### 3. 保存しない情報

- binary audio data（容量過大のため）
- ユーザー個人情報
- 認証情報
- ブラウザ履歴
- page DOM content

### 4. Save / Resume の挙動

| 操作 | 挙動 |
|---|---|
| transcript.segment 受信 | 1 秒 debounce 後に `chrome.storage.local` に自動保存 |
| 保存状態表示 | "Unsaved changes…" → "Saved locally HH:MM" を toolbar 下部に表示 |
| Side Panel 再読み込み | 起動時に `chrome.storage.local` から復元。DOM 再構築、全ボタン有効 |
| 復元表示 | "Restored from local storage — N segments (HH:MM:SS)" を表示 |
| session.stop | debounce を flush して即時保存 |
| 新規 Start（既存 session あり） | 既存 session があれば即時保存し、新規 session を開始（上書き防止） |
| Clear Transcript | confirm() 後、segments 配列・DOM・storage 全てクリア |
| 不正データ検出時 | storage の不正データを自動削除し、エラーログ出力 |

### 5. Storage テスト

```
Serialize:   6/6 passed
Deserialize: 3/3 passed
Validate:    5/5 passed
upsert:      1/1 passed
─────────────────────────
Total:      15/15 passed
```

テスト項目:
- 全フィールドの serialize/deserialize 往復
- schemaVersion 検証
- 不正データ拒否（null / 欠落フィールド / 不正version）
- upsertSegment 後の永続化データ整合性
- 復元 session から Markdown export 可能

### 6. Track Record

| テスト | 結果 |
|---|---|
| `npm run typecheck` | 0 errors |
| `export serializers` | 18/18 passed（維持） |
| `storage persistence` | 15/15 passed（追加） |
| mock-transcriber smoke | 維持（変更なし） |
| real-transcriber smoke | 維持（変更なし） |

## 確認できなかったこと

| 項目 | 理由 |
|---|---|
| 実 Chrome Extension 上での chrome.storage.local 読み書き | ブラウザ環境が必要 |
| storage quota 超過時の挙動 | テスト未実施（chrome.storage.local は通常 10MB+） |
| Side Panel が閉じられた状態での segment 到着 | Service Worker 側で受信するが sidepanel 非表示時は保存未検証 |
| 複数セッション履歴管理 | 初期実装では current session のみ |
| 長期間放置後の復元（数時間以上） | テスト未実施 |

## Privacy Note

- 保存先は `chrome.storage.local`（外部送信なし）
- ユーザーの明示的な Clear 操作で削除可能
- 拡張アンインストール時に Chrome が自動削除
- binary audio は保存しない
- クラウド同期・共有機能は実装しない

## 既知の制限

- 複数 session の履歴管理は未実装（current session のみ）
- debounce 1 秒以内に sidepanel を閉じた場合、未保存の可能性あり（session.stop 時に flush するが、クラッシュ時は未保存）
- storage 容量は chrome.storage.local の quota に依存（通常 10MB、managed storage で拡張可能）
- schemaVersion 変更時のマイグレーションは未実装（不一致時は自動削除）

## 設計上の位置づけ

local persistence は文脈喪失を防ぐための保存境界である。

- transcript は一次記録であり、意味解釈ではない
- 保存済み transcript は ASR 誤認識を含みうる
- local storage は同期・共有・クラウド保存ではない
- 将来の Kotomi Core sync / RDE event 化 / search index 化とは別層
