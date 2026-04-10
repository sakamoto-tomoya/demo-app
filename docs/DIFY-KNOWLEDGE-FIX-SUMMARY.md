# Dify ナレッジ登録 修正サマリー

## 1. 原因

- **エンドポイントの誤り**  
  実装で `document/create_by_text`（アンダースコア）を使っており、Dify 公式 API の正しいパスは **`document/create-by-text`**（ハイフン）です。  
  このため Dify 側で 404 等となり、ドキュメントが登録されていませんでした。
- レスポンスの `status` や本文をログに残しておらず、失敗理由の切り分けが困難でした。
- 失敗時にフロントへ返す情報が `error` 文字列のみで、**HTTP status / Dify の code・message** が画面に出ていませんでした。

## 2. 修正ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `src/app/api/dify/knowledge/route.ts` | エンドポイントを `create-by-text` に変更、ログ追加、レスポンス形式統一（ok/status/difyResponse）、indexing-status 確認、documents 一覧確認 |
| `src/components/CaseForm.tsx` | 新レスポンス形式に対応、失敗時に status / Dify code / message を表示、成功時に indexingStatus を表示（2箇所: handleSubmit 内 Dify 同期・handleDifyResync） |
| `src/app/parts/master/page.tsx` | `data.ok === true` で成功判定に統一、失敗時に status と difyResponse.message を表示（部品マスタ・製品型番と部品の2箇所） |

## 3. 修正前の問題点

- **エンドポイント**: `create_by_text` を使用しており、公式の `create-by-text` と一致していなかった。
- **ログ**: `dataset_id`・エンドポイント・API キー（マスク）・**response.status**・**response.body** を記録していなかった。
- **レスポンス**: 成功時のみ `document.id` を返しており、`batch` や indexing 状態を返していなかった。失敗時は HTTP ステータスをそのまま返し、body に `error` のみで Dify の code/message が含まれていなかった。
- **indexing-status**: 作成後に `GET /datasets/{dataset_id}/documents/{batch}/indexing-status` で確認していなかった。
- **documents 一覧**: 作成後に `GET /datasets/{dataset_id}/documents` で実在確認していなかった。
- **フロント**: 失敗時に「HTTP status」「Dify error code」「Dify message」を表示していなかった。

## 4. 修正後の通信ログ例

### サーバー（Next.js API Route）ログ

```
[dify/knowledge] dataset_id= 2073c54f-9d0c-4170-bee3-7080de8d18ec endpoint=create-by-text apiKey= dataset-...yV0
[dify/knowledge] POST createUrl= https://api.dify.ai/v1/datasets/2073c54f-9d0c-4170-bee3-7080de8d18ec/document/create-by-text name.length= 25 text.length= 320
[dify/knowledge] create response status= 200 body= {"document":{"id":"...","name":"..."},"batch":"..."}
[dify/knowledge] indexing-status batch= xxx indexing_status= waiting
[dify/knowledge] documents list check docId= xxx found= true
```

### 失敗時ログ例

```
[dify/knowledge] create response status= 404 body= {"code":"not_found","message":"Dataset not found"}
[dify/knowledge] create API error status= 404 code= not_found message= Dataset not found
```

### フロント表示（失敗時）

```
Dify登録失敗：HTTP 404 | Dify code: not_found | Dataset not found
```

## 5. Dify documents 一覧に追加された確認方法

1. **サーバーログ**  
   作成成功後に次のログが出力されます。  
   `[dify/knowledge] documents list check docId= <document_id> found= true`  
   `found= true` であれば、当該ナレッジの documents 一覧にドキュメントが存在します。

2. **Dify 管理画面**  
   対象ナレッジ（Dataset）を開き、「ドキュメント」タブで一覧を確認。名前（`name` で送った値）で検索できる場合があります。

3. **API で直接確認**  
   `Authorization: Bearer {DIFY_KNOWLEDGE_API_KEY}` を付けて  
   `GET https://api.dify.ai/v1/datasets/{DIFY_DATASET_ID}/documents?page=1&limit=20`  
   を実行し、レスポンスの `data` に作成した `document.id` または該当する `name` が含まれるか確認します。

4. **画面の成功表示**  
   「登録」成功後、学習データブロックに「登録成功（インデックス: completed）」や「学習データに登録済み（インデックス: waiting）。下の「登録する」で…」のように表示され、API が 200 かつ `ok: true` で返していることを示します。
