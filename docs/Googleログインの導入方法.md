# サイトにアクセスした際、Googleアカウントでログインして閲覧できるようにする

**NextAuth.js** と Google OAuth を使って、ログインしていないユーザーをログインページへ誘導する方法です。

---

## 1. Google Cloud Console で認証情報を作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成するか、既存プロジェクトを選択
3. **APIとサービス** → **認証情報** → **認証情報を作成** → **OAuth クライアント ID**
4. 同意画面を設定（まだの場合）  
   - ユーザータイプ: 外部 or 内部（組織用）
5. アプリケーションの種類: **ウェブアプリケーション**
6. **承認済みのリダイレクト URI** に以下を追加  
   - 開発: `http://localhost:3000/api/auth/callback/google`  
   - 本番: `https://あなたのドメイン/api/auth/callback/google`
7. **クライアントID** と **クライアントシークレット** を控える

---

## 2. 必要なパッケージをインストール

```bash
npm install next-auth@beta
```

※ Next.js 16 の場合は `next-auth@beta`（v5）を推奨

---

## 3. 環境変数を設定

`.env.local` に以下を追加:

```env
AUTH_SECRET=ランダムな文字列（例: openssl rand -base64 32 で生成）
AUTH_GOOGLE_ID=あなたのGoogleクライアントID
AUTH_GOOGLE_SECRET=あなたのGoogleクライアントシークレット
```

---

## 4. NextAuth の設定ファイルを作成

`src/auth.ts` を作成:

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  pages: {
    signIn: "/api/auth/signin", // カスタムログインページ（任意）
  },
});
```

---

## 5. API ルートを追加

`src/app/api/auth/[...nextauth]/route.ts` を作成:

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

---

## 6. ミドルウェアで未ログイン時リダイレクト

プロジェクト直下に `middleware.ts` を作成:

```ts
import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/api/auth");
  if (!isLoggedIn && !isAuthPage) {
    return Response.redirect(new URL("/api/auth/signin", req.url));
  }
  return undefined;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.png$).*)"],
};
```

※ ロゴや favicon など静的ファイルはマッチ対象外にしています。

---

## 7. セッションプロバイダーをレイアウトに追加

`src/app/layout.tsx` で `SessionProvider` でラップし、ログアウトボタンなどを表示したい場合は `Nav` 内で `useSession()` を使います。

（NextAuth v5 ではミドルウェアで保護するだけで、レイアウトの変更は必須ではありません）

---

## 8. ログインページ（任意）

NextAuth の標準ログインページ（`/api/auth/signin`）を使う場合は追加の実装は不要です。

カスタムページを作る場合は、ボタンで `signIn("google")` を呼び出します。

---

## 補足

- **許可するメールアドレスを絞る場合**: `auth` の `callbacks` で `signIn` コールバックを定義し、許可するドメイン（例: `@company.com`）やメールアドレスをチェック
- **印刷用ページ** などログイン不要にしたいパスは、ミドルウェアの `matcher` か条件分岐で除外する
- 本番では必ず `AUTH_SECRET` を設定し、HTTPS で運用してください
