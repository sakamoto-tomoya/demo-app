This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Vercel 公開手順

1. [Vercel](https://vercel.com) にログインし、GitHub リポジトリをインポート（または `vercel` CLI でリンク）。
2. プロジェクトの **Settings → Environment Variables** で以下を設定（公開デモ用）。
   - `ACCESS_PASSWORD` = 共通パスワード（未設定なら本番では全ページ「ログイン無効」で閉じます）
   - `DEMO_MODE` = `true`
   - `SETTINGS_PASSWORD` = 設定画面にアクセスするためのパスワード（未設定なら設定画面は「利用できません」表示）
   - `AUTH_SECRET` = `openssl rand -base64 32` で生成した値（経理・Google ログインを使う場合）
   - （任意）`NEXT_PUBLIC_SALESFORCE_URL` / `NEXT_PUBLIC_PARTS_ORDER_URL` = デモ用 URL または空
3. **Deploy** を実行。本番 URL が発行されたら、Google ログインを使う場合は **Google Cloud Console** の OAuth 同意画面でその URL をリダイレクト URI に追加し、`AUTH_URL` に本番 URL を設定して再デプロイ。

---

## 公開デモ手順（5〜10 ステップ）

1. リポジトリを GitHub に push する（`.env` / `.env.local` はコミットしない）。
2. [Vercel](https://vercel.com) にログインし、**Add New Project** から該当リポジトリをインポートする。
3. プロジェクトの **Settings → Environment Variables** を開く。
4. **DEMO_MODE** を `true` で追加する（必須・公開デモ用）。
5. **SETTINGS_PASSWORD** を設定する（設定画面を開くパスワード。未設定のままなら設定画面は「利用できません」表示）。
6. **AUTH_SECRET** を追加する（`openssl rand -base64 32` で生成。経理・Google ログインを使う場合に必須）。
7. 必要なら **NEXT_PUBLIC_SALESFORCE_URL** / **NEXT_PUBLIC_PARTS_ORDER_URL** にデモ用 URL を設定する（秘密情報は入れない）。
8. **Deploy** を実行し、本番 URL を確認する。
9. Google ログインを使う場合は、**Google Cloud Console** でリダイレクト URI に上記 URL を追加し、Vercel の **AUTH_URL** にその URL を設定して再デプロイする。
10. 最終公開チェックリスト（下記）で動作と設定を確認してから公開する。

---

## ローカルでの Document AI（高精度OCR）

書類PDFのOCRは **Google Document AI** を利用します。ローカル（`npm run dev`）でも同じAPIが使われ、未設定・認証エラー時は Tesseract にフォールバックせずエラーを表示します。

### ローカルで Document AI を使う手順

1. **Google Cloud で Document AI を有効化**
   - [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成または選択
   - **API とサービス** → **ライブラリ** で「Cloud Document AI API」を有効化
   - **Document AI** でプロセッサを作成（フォーム・ドキュメント用など）。リージョン（例: `us`）とプロセッサ ID を控える

2. **サービスアカウント鍵**
   - **IAM と管理** → **サービスアカウント** でキーを作成し、JSON 鍵をダウンロード
   - プロジェクトルートに配置（例: `pdf-run-xxxx.json`）。`.gitignore` で除外されていることを確認

3. **`.env.local` に設定**
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=./pdf-run-xxxx.json
   GOOGLE_CLOUD_PROJECT_ID=あなたのプロジェクトID
   DOCUMENT_AI_LOCATION=us
   DOCUMENT_AI_PROCESSOR_ID=プロセッサID
   ```
   - 相対パス（`./pdf-run-xxxx.json`）のときは、**プロジェクトのルート**（`gyoumukannri` フォルダ）に鍵JSONを置いてください。
   - **Windows で「ファイルが存在しない」になる場合**は、絶対パスを指定してください。例:  
     `GOOGLE_APPLICATION_CREDENTIALS=C:/Users/あなたのユーザー名/Downloads/pdf-run-xxxx.json`  
     （スラッシュで書くと Windows でもそのまま使えます。）

4. 開発サーバーを再起動（`npm run dev`）。案件登録で PDF をアップロードすると Document AI でOCRされます。

※ 未設定のまま PDF をアップロードすると、**Mock モード**に自動切り替わり、事前保存済みのサンプル抽出結果が返ります（下記「Document AI Mock モード」参照）。

### Document AI Mock モード（ポートフォリオ・Billing なしで動作）

- **DOCUMENT_AI_USE_MOCK=true** を `.env.local` に追加すると、常に Mock が使われます（環境変数・Billing 不要）。
- 未設定のままでも、環境変数不足や Document AI のエラー時は **自動で Mock に切り替わります**。
- Mock 用データ: `data/ocr-mock/sample.documentai.json` と `sample.mapping.json` を配置してください（リポジトリに同梱済み）。
- 画面上で **PDF プレビュー・抽出項目一覧・信頼度・座標（バウンディングボックス）・要確認項目の色分け** が表示されます。
- サンプル PDF を表示したい場合は、任意の PDF を **public/sample.pdf** としてコピーしてください。

---

## OCR 学習データの蓄積と Azure Document Intelligence Studio での再トレーニング

受付新規登録で OCR したあとに手動で修正した内容を保存し、蓄積したデータを Azure Document Intelligence Studio に取り込んで再トレーニングする運用で、OCR 精度を継続的に改善できます。

### 1. 手修正内容の保存（この内容で保存）

- 受付新規登録画面で PDF をアップロードして OCR を実行したあと、フォームの各項目を必要に応じて手動で修正します。
- **「この内容で保存」** ボタンを押すと、現在のフォームの値（修正後）と、OCR に使用した PDF のファイル名が DB の `ocr_training_data` テーブルに保存されます。
- 手修正のたびにこの操作を行うことで、「正解ラベル付き」の学習データが蓄積されていきます。

### 2. CSV エクスポート（Studio インポート用）

- 画面上の **「CSVエクスポート」** ボタンを押すと、蓄積した学習データが CSV 形式でダウンロードされます。
- CSV の列は Azure Document Intelligence Studio で利用するフィールド名（修理受付番号・ご依頼店名・お客様名・型式名・問合/依頼内容 など）に合わせており、Studio にインポートしてラベル付けや再トレーニングに利用できる形式です。
- 文字コードは UTF-8（BOM 付き）です。

### 3. 定期的な再トレーニング運用フロー

1. **日常運用**  
   受付時に OCR で自動転記し、誤りがあれば手修正して **「この内容で保存」** で学習データとして保存する。
2. **データの蓄積**  
   一定件数（例: 50 件〜100 件）たまったら、画面上の **「CSVエクスポート」** で CSV をダウンロードする。
3. **Studio への取り込み**  
   - [Azure Document Intelligence Studio](https://documentintelligence.azure.com/) を開き、使用しているカスタムモデル（例: `paloma-repair-model`）のプロジェクトを選択する。
   - エクスポートした CSV を参考に、対応する PDF と正解ラベルを Studio にアップロードする（Studio のインポート手順に従う）。
4. **ラベル付け・再トレーニング**  
   - 必要に応じて Studio 上でラベルを調整し、モデルの再トレーニングを実行する。
   - 学習が完了したら、新しいモデルバージョンをデプロイし、本アプリの OCR で利用する。
5. **繰り返し**  
   上記を定期的（例: 月 1 回）に実施することで、手修正のたびに精度向上に使えるデータが蓄積され、OCR 精度が段階的に向上します。

### 技術メモ

- 学習データは Turso（`ocr_training_data` テーブル）に保存されます。初回は `npm run db:init` または `/api/debug/init-db` でテーブルを作成してください。
- 保存 API: `POST /api/ocr-training-data`（JSON で `pdf_file_name` と各フィールドを送信）。
- エクスポート API: `GET /api/ocr-training-data/export`（CSV を返却）。

---

## 共通パスワード（アクセス保護）

公開 URL にアクセスした人が、共通パスワードを入力しないとアプリを見られないようにする機能です。

### 設定方法

1. 環境変数 **ACCESS_PASSWORD** に共通パスワードを設定する（例: `my-demo-secret`）。
2. 未設定のまま本番にデプロイした場合の挙動は **採用A** です。  
   **本番で ACCESS_PASSWORD が未設定なら全体を閉じる**（`/login` に飛び、「管理者によりログインは無効化されています」と表示）。

### 利用の流れ

1. ユーザーが任意のページにアクセスする。
2. 未認証なら `/login?callbackUrl=元のパス` にリダイレクトされる。
3. 「アクセス保護」画面でパスワードを入力してログインする。
4. 認証に成功すると Cookie が発行され、**元のアクセス先（callbackUrl）** へリダイレクトされて閲覧できる。Cookie 有効期限はデフォルト **3 日**（環境変数 `ACCESS_COOKIE_MAX_AGE_DAYS` で 1〜30 日に変更可能）。
5. サイドメニューの **アクセス解除** をクリックすると Cookie が削除され、再度パスワード入力が必要になる。

### 除外パス

- `/login` … ログイン画面
- `/api/auth/access` … パスワード送信・ログアウト用 API
- `/_next/*`、`/favicon.ico`、画像など静的ファイル

### 注意

- パスワードは **NEXT_PUBLIC_** にせず、サーバー側の環境変数のみで管理する。
- Cookie は `httpOnly` / **本番では必ず `secure: true`** / `sameSite: lax` で設定している。**localhost 開発時は secure: false で動作**する。
- ログイン失敗が **15 分あたり 5 回を超える**と、その IP からは一時的に 429 が返る簡易制限がある（メモリ実装。本番では Redis 等を推奨）。
- middleware に加え、**重要 API（設定ユーザー・メール設定・入金取得・OCR・入庫通知）では API 側でもアクセス認証を確認**している（二重チェック）。
- ログイン後のリダイレクト先（callbackUrl）は **同一オリジン・パスのみ**に制限し、オープンリダイレクトを防いでいる。

---

## 公開デモ運用時の注意

- **DEMO_MODE**: 公開デモでは必ず `DEMO_MODE=true` にしてください。変更系 API（登録・更新・削除・OCR・入金取得・メール送信）は 403、参照系（ジオコード）はモック座標を返します。
- **SETTINGS_PASSWORD**: 本番では設定画面を開くパスワードを設定するか、未設定のまま「利用できません」表示にしてください。
- **AUTH_SECRET**: 本番で経理・Google ログインを使う場合は必須です。
- **NEXT_PUBLIC_***: クライアントに露出するため **URL のみ**とし、API キー・`service_role` 等の秘密は含めないでください。
- **データ**: 案件・部品・経費はブラウザの localStorage に保存されます。デモでは永続化されません。
- **レート制限**: 現在は **デモ用の簡易レート制限（メモリ実装）** です。同一インスタンス内で 1 分あたり約 120 リクエスト/IP まで。**本番運用では Upstash Redis 等の外部ストアを使ったレート制限を推奨**します。
- セキュリティ詳細: [docs/SECURITY-AUDIT-DEMO.md](docs/SECURITY-AUDIT-DEMO.md) / [docs/SECURITY-DEMO-FOLLOWUP.md](docs/SECURITY-DEMO-FOLLOWUP.md)

### 動作確認端末（バーコード読取・スマホ向け）

- **iPhone 11 Pro** / **iPhone SE**（Safari でカメラ・写真・手入力）
- **Android**（Chrome でカメラ・写真・手入力）

※ iOS のアプリ内ブラウザ（LINE 等）ではカメラが使えないため、カメラ利用時は Safari で開くか「写真から読み取る」「手入力」を利用してください。詳細は [docs/BARCODE-SCANNER-IMPROVEMENT.md](docs/BARCODE-SCANNER-IMPROVEMENT.md) を参照。

---

## 公開デモ時の注意点（要約）

上記「Vercel 公開手順」「公開デモ運用時の注意」を参照してください。

---

## 最終公開チェックリスト（GitHub push 前・Vercel デプロイ前）

以下を満たしてから **GitHub に push** し、Vercel で **Deploy** してください。

- [ ] **リポジトリ**
  - [ ] `.env` / `.env.local` をコミットしていない（`.gitignore` に `.env*` があることを確認）
  - [ ] 秘密情報（API キー・パスワード）がソースコードに直書きされていない
- [ ] **環境変数（Vercel）**
  - [ ] 本番で `ACCESS_PASSWORD` を設定した（共通パスワード保護を使う場合。未設定なら全ページ閉じる）
  - [ ] `DEMO_MODE=true` を設定した
  - [ ] 本番で `SETTINGS_PASSWORD` を設定した（または未設定で設定画面を閉じる）
  - [ ] `AUTH_SECRET` を設定した（経理・Google ログインを使う場合）
  - [ ] `NEXT_PUBLIC_*` に秘密情報を含めていない
- [ ] **動作確認**
  - [ ] 設定画面が本番で意図どおり（パスワード未設定なら「利用できません」）
  - [ ] デモモードで変更系 API が 403、ジオコードがモック座標かつ UI に「デモ用サンプル」と表示されること
  - [ ] ジオコード地図で「※ 表示位置はデモ用サンプル（東京駅付近）です」が出ること
- [ ] **URL・データ**
  - [ ] デモ用に `NEXT_PUBLIC_SALESFORCE_URL` / `NEXT_PUBLIC_PARTS_ORDER_URL` をデモ用または空にしている
- [ ] **ドキュメント**
  - [ ] README の「公開デモ時の注意点」「最終公開チェックリスト」を一読した

---

## ローカル起動手順（ポートフォリオ・Mock 用）

Document AI の Billing や鍵なしで OCR 画面を動かす場合の手順です。

1. **リポジトリをクローンし、依存関係を入れる**
   ```bash
   cd gyoumukannri
   npm install
   ```

2. **Mock モードを有効にする（任意）**
   - `.env.local` に次の1行を追加する:
     ```env
     DOCUMENT_AI_USE_MOCK=true
     ```
   - 追加しない場合も、Document AI の環境変数が未設定なら **自動で Mock** になります。

3. **開発サーバーを起動する**
   ```bash
   npm run dev
   ```

4. **ブラウザで開く**
   - [http://localhost:3000](http://localhost:3000) を開く。
   - アクセス保護がかかっている場合は、設定したパスワードでログインする。

5. **OCR を試す**
   - **案件管理**（新規案件）を開く。
   - 「PDFで自動転記」の **ファイル選択** で、任意の PDF を1枚選ぶ。
   - Mock のときは、どの PDF でも **同じサンプル抽出結果** がフォームに反映され、その下に **OCR 抽出結果**（項目一覧・信頼度・座標）が表示される。

6. **サンプル PDF のプレビューを出す（任意）**
   - 任意の PDF を **public/sample.pdf** という名前でコピーする。
   - 同じ画面で OCR 実行後、「PDF プレビュー」欄にその PDF が表示される。

本番で Document AI を使う場合は、上記「ローカルでの Document AI」のとおり環境変数と鍵を設定し、`DOCUMENT_AI_USE_MOCK` は削除または `false` にしてください。

---

## Dify ナレッジベース（案件保存時の自動登録）

`/api/cases` で案件を保存したあと、Dify Knowledge API で **1 件 1 ドキュメント** としてテキスト登録します。登録に失敗しても **案件保存は成功** のままです。

- **受付ナレッジ**（`DIFY_KNOWLEDGE_DATASET_ID`）: 案件保存のたびに登録（受付番号・依頼元店名・電話・お客様名・住所・電話・型式・症状・問合内容）
- **修理履歴ナレッジ**（`DIFY_REPAIR_HISTORY_DATASET_ID`）: ステータスが **完了** の保存時のみ登録（上記に加え修理内容・使用部品・完了日）

`.env.local` の例:

```env
# ナレッジ用 Dataset API キー
DIFY_KNOWLEDGE_API_KEY=your-api-key
# 受付ナレッジ用データセット ID（必ず UUID。APIキー dataset-... とは別）
DIFY_KNOWLEDGE_DATASET_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# 修理履歴ナレッジ用データセット ID
DIFY_REPAIR_HISTORY_DATASET_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

- 呼び出し: `POST https://api.dify.ai/v1/datasets/{dataset_id}/document/create_by_text`（`Authorization: Bearer`、`Content-Type: application/json`）
- ドキュメント名例: `受付番号_XXXXXXXX`
- ターミナルログ例: `[dify-knowledge] 受付ナレッジ登録成功: 受付番号XXXXXXXX` / `[dify-knowledge] 修理履歴ナレッジ登録成功: 受付番号XXXXXXXX`（失敗時は `登録失敗`、未設定時は `スキップ`）

### Dify ワークフロー（案件保存後の `runDifyWorkflow` / 受付チェック）

- **`/v1/workflows/run` にはワークフローアプリの API キーを使う**（チャットボット用 `DIFY_APP_API_KEY` だけを渡すと 400 になりやすい）。
- 受付チェック（`/api/dify/reception-check`）: `DIFY_RECEPTION_CHECK_API_KEY` ＋ `DIFY_RECEPTION_CHECK_URL`（省略時は `https://api.dify.ai/v1/workflows/run`）
- 案件保存後ワークフロー: 優先 **`DIFY_CASE_WORKFLOW_API_KEY`** / `DIFY_CASE_WORKFLOW_URL`、なければ `DIFY_WORKFLOW_*`、`DIFY_RECEPTION_CHECK_*`、`DIFY_API_KEY`
