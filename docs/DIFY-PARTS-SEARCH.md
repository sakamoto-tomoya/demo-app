# Dify から部品検索 API を呼ぶ手順

Next.js の `GET /api/parts/search?model=...` は、クエリ文字列（`model` パラメータ）を **部分一致** で Turso の `parts` に当てます。`model`・`part_name`・`symptom` のいずれかに含まれる行がヒットします（`LIKE '%語%'`）。レスポンスは `{ parts: [{ part_number, part_name, symptom, note }] }` です。

## 1. Next.js をホストから到達可能にする

- 開発時: 例 `npm run dev` で **ポート 3000** をリッスン（デフォルト）。
- Dify だけが Docker の場合、コンテナからホストの Next.js へは **`host.docker.internal`** を使います（Windows / macOS の Docker Desktop で一般的）。

## 2. Dify ワークフローで HTTP ノードの URL を設定

1. ワークフローを開き、**DB 部品検索**（または HTTP Request / API 呼び出し）ノードを選択する。
2. **URL** を次のようにする（`{{model_name}}` はワークフロー変数。Dify の変数名に合わせてよい）:

   ```text
   http://host.docker.internal:3000/api/parts/search?model={{model_name}}
   ```

3. **メソッド**: `GET`
4. **Headers**: 通常は不要（本 API は Cookie / Google ログインを要求しない）。

## 3. Linux 上の Docker の注意

`host.docker.internal` が使えない場合は、次のいずれかを検討する。

- `--add-host=host.docker.internal:host-gateway` でコンテナを起動する。
- ホストの LAN IP（例: `http://192.168.x.x:3000/api/parts/search?model=...`）を直接書く。
- Next.js も Docker に載せ、同一ネットワーク内のサービス名で名前解決する。

## 4. 動作確認（ホスト側）

ブラウザまたは curl:

```bash
curl "http://localhost:3000/api/parts/search?model=JT-611W"
```

Docker 内から:

```bash
curl "http://host.docker.internal:3000/api/parts/search?model=JT-611W"
```

## 5. ミドルウェア

`/api/parts/search` は **共通パスワード（ACCESS_PASSWORD）** と **NextAuth 未ログイン** のブロック対象外です。Dify から Cookie なしで呼べます。

本番でこの URL をインターネットに公開する場合は、別途 API キーや IP 制限の検討を推奨します。
