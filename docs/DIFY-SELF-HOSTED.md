# Dify セルフホスト（Docker）連携メモ

## 環境変数（`.env.local`）

| 変数 | 例（このリポジトリの既定） | 用途 |
|------|---------------------------|------|
| `DIFY_BASE_URL` | `http://localhost/v1` | 全 API のベース（末尾 `/v1`、末尾スラッシュ不要） |
| `DIFY_RECEPTION_CHECK_URL` | `http://localhost/v1/workflows/run` | 受付チェックワークフロー（未設定時は `DIFY_BASE_URL` + `/workflows/run` でも可） |
| `DIFY_API_KEY` | `app-...` | 汎用・レガシー（`dify-workflow` のフォールバック） |
| `DIFY_APP_API_KEY` | `app-...` | **チャット**アプリ（`/api/dify` のみ。repair-assist では使わない） |
| `DIFY_REPAIR_ASSIST_API_KEY` | `app-...` | （任意）AI 修理アシスト専用ワークフローの API キー |
| `DIFY_REPAIR_ASSIST_WORKFLOW_URL` | `http://localhost/v1/workflows/run` | （任意）修理アシストの `workflows/run` フル URL。未設定時は `DIFY_BASE_URL` + `/workflows/run` |
| `DIFY_RECEPTION_CHECK_API_KEY` | `app-...` | **ワークフロー**アプリのキー。修理アシストは未設定時ここをフォールバック利用 |
| `DIFY_KNOWLEDGE_API_KEY` | `dataset-...` 等 | データセット・ナレッジ API |
| `DIFY_KNOWLEDGE_DATASET_ID` | UUID | Web 完了登録ナレッジ |
| `DIFY_REPAIR_HISTORY_DATASET_ID` | UUID | 修理履歴ナレッジ |

キー取得: ブラウザで `http://localhost` → 対象アプリ → 左 **API アクセス** → **API キーを作成**。

データセット ID: **ナレッジ** でデータセットを作成し、一覧または詳細に表示される UUID をコピーする（`dataset-` で始まる文字列は **API キー**であり、ID 欄には入れない）。

## コード側の挙動

- `DIFY_BASE_URL` が設定されていれば、`dify-knowledge.ts` の受付・修理履歴の `create_by_text` も同じホストへ向く（クラウド固定を廃止済み）。
- `DIFY_RECEPTION_CHECK_URL` 未設定時は `DIFY_BASE_URL` + `/workflows/run`。
- `dify-workflow.ts` の `workflows/run` 既定も同様。
- **`/api/dify/repair-assist`** は `POST …/workflows/run` のみ（`/chat-messages` は使わない）。API キーはワークフロー型アプリのものを `DIFY_REPAIR_ASSIST_API_KEY` または `DIFY_RECEPTION_CHECK_API_KEY` 等に設定。

## 動作確認の目安

1. `.env.local` を埋めたあと **Next を再起動**（`npm run dev`）。
2. `/api/debug/env-check` で Dify 系が `set` になっているか（値は表示されない場合あり）。
3. 案件画面の AI 修理アシストなどで応答・ナレッジヒットを確認。

## Docker の URL について

リバースプロキシで **80 番にマップ**している想定なら `http://localhost/v1` でよい。  
別ポート（例: `http://localhost:5001/v1`）の場合は `DIFY_BASE_URL` と `DIFY_RECEPTION_CHECK_URL` をそのホストに合わせて変更する。
