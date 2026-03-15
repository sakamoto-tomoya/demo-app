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
