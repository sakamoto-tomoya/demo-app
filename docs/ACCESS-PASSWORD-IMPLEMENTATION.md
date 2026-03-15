# 共通パスワード保護 実装ドキュメント

## 1. 実装方針

- **目的**: 公開 URL にアクセスした人が、指定した共通パスワードを入力しないとアプリを見られないようにする。
- **構成**:
  - `/login` ページでパスワード入力フォームを表示。
  - `POST /api/auth/access` でパスワードを送信し、サーバー側で `ACCESS_PASSWORD` と照合。一致したら `access_gate` Cookie を発行（httpOnly / **本番では必ず secure: true** / sameSite: lax）。**Cookie 有効期限はデフォルト 3 日**（`ACCESS_COOKIE_MAX_AGE_DAYS` で 1〜30 日に変更可能）。
  - **localhost 開発時**は `secure: false` のため http://localhost でそのまま動作する。
  - ログイン失敗が **15 分あたり 5 回を超えた** IP には 429 を返す簡易制限（`access-login-limit.ts`）。成功時に該当 IP のカウントをリセット。
  - `middleware.ts` で先に「アクセス保護」を実行。対象外パス以外は Cookie がなければ `/login?callbackUrl=元のパス` にリダイレクト。**ログイン成功後は callbackUrl へリダイレクト**（同一オリジン・パスのみに制限しオープンリダイレクト防止）。
  - **重要 API**（設定ユーザー・メール設定・入金取得・OCR・入庫通知）では **API 側でも `requireAccessAuth()` を呼び**、Cookie 未所持なら 401 を返す二重チェックを実施。
  - 本番で `ACCESS_PASSWORD` が未設定のときは **採用A**：全体を閉じ、`/login?unconfigured=1` に飛ばし「管理者によりログインは無効化されています」と表示。
  - 認証後は既存の NextAuth（Google ログイン）と同様に利用可能。サイドメニューに「アクセス解除」を追加し、`GET /api/auth/access/logout` で Cookie 削除後に `/login` へリダイレクト。
- **既存との関係**: 設定画面の `SETTINGS_PASSWORD` や `DEMO_MODE` とは独立。アクセス保護を通ったあとで、従来どおりトップで Google ログインや設定画面のパスワードが使われる。

---

## 2. 危険ポイントと対策

| 危険ポイント | 対策 |
|--------------|------|
| パスワードがクライアントに露出 | パスワードは `process.env.ACCESS_PASSWORD` のみ。NEXT_PUBLIC_ は使わない。 |
| パスワード比較のタイミング攻撃 | API で `crypto.timingSafeEqual` を使用。 |
| Cookie の改ざん・盗聴 | httpOnly で JavaScript から参照不可。**本番では必ず secure: true** で HTTPS のみ。localhost 開発時は secure: false で動作。sameSite: lax で CSRF を軽減。 |
| エラー時に秘密情報を返す | 認証失敗時は「パスワードが正しくありません」のみ。500 時もスタックや内部詳細は返さない。 |
| ブルートフォース | 既存の `checkRateLimit` に加え、**15 分あたり 5 回を超える失敗**で 429 を返す簡易制限（`access-login-limit.ts`）を実施。成功時に該当 IP のカウントをリセット。 |
| 本番でパスワード未設定 | 採用A：本番かつ未設定なら全リクエストを `/login?unconfigured=1` にリダイレクトし、ログイン不可と表示。 |

---

## 3. 修正対象ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `middleware.ts` | 共通パスワード用の対象外判定・Cookie 確認を先に実行。未認証時は `/login` へリダイレクト。その後既存 NextAuth を実行。 |
| `src/components/Nav.tsx` | サイドメニューに「アクセス解除」リンク（`/api/auth/access/logout`）を追加。 |
| `.env.example` | `ACCESS_PASSWORD` の説明を追加。 |
| `README.md` | 「共通パスワード（アクセス保護）」セクション、Vercel 手順・チェックリストに ACCESS_PASSWORD を追記。 |

---

## 4. 新規追加ファイル一覧

| ファイル | 説明 |
|----------|------|
| `src/lib/access-auth.ts` | Cookie 名・未設定判定・Cookie オプションの共通定義。 |
| `src/app/api/auth/access/route.ts` | POST: パスワード照合と Cookie 発行。本番未設定時は 503 + unconfigured。 |
| `src/app/api/auth/access/logout/route.ts` | GET: Cookie 削除して `/login` へリダイレクト。 |
| `src/app/login/page.tsx` | アクセス保護用ログイン画面。callbackUrl を同一オリジン・パスのみに制限してからリダイレクト。429 時は「試行回数が多すぎます」を表示。 |
| `src/lib/access-login-limit.ts` | ログイン失敗回数の簡易制限（15 分あたり 5 回超過で 429）。 |
| `docs/ACCESS-PASSWORD-IMPLEMENTATION.md` | 本ドキュメント。 |

---

## 5. 変更コード全文

### middleware.ts（抜粋・要点）

- 先頭で `isAccessExempt(pathname)` と `hasAccessCookie(req)` を定義。
- 本番かつ `ACCESS_PASSWORD` 未設定 → `/login?unconfigured=1` にリダイレクト。
- パスワード設定済みかつ Cookie なし → `/login?callbackUrl=...` にリダイレクト。
- 上記以外は `withNextAuth(req, event)` を実行（既存 NextAuth の挙動を維持）。

### src/lib/access-auth.ts

- `ACCESS_COOKIE_NAME = "access_gate"`、`getAccessCookieOptions()`、`isAccessPasswordUnset()`、`isAccessPasswordConfigured()` を export。

### src/app/api/auth/access/route.ts

- POST: レート制限 → 本番未設定なら 503 { ok: false, error: "unconfigured" } → パスワード未設定なら 200 { ok: true } → body.password と `ACCESS_PASSWORD` を `timingSafeEqual` で比較 → 一致なら Cookie を付与して 200 { ok: true }、不一致なら 401。

### src/app/api/auth/access/logout/route.ts

- GET: `access_gate` Cookie を maxAge: 0 で削除し、`NextResponse.redirect("/login")`。

### src/app/login/page.tsx

- クライアントコンポーネント。`callbackUrl` / `unconfigured` を searchParams から取得。
- unconfigured 時は「管理者によりログインは無効化されています」のみ表示。
- フォーム: パスワード入力 → POST /api/auth/access → 成功時は `router.push(callbackUrl)`、失敗時は「パスワードが正しくありません」または「通信エラー…」を表示。

### Nav.tsx

- ログアウトブロック内に `<a href="/api/auth/access/logout">アクセス解除</a>` を追加。

---

## 6. .env.example 追記内容

```env
# 共通パスワード（アクセス保護）。設定すると /login でパスワード入力後にのみ全ページ閲覧可能。
# 本番で未設定の場合は「ログイン無効」となり全ページ閉じます（採用A）。
ACCESS_PASSWORD=
```

（既存の DEMO_MODE の直前に上記を追加。）

---

## 7. README 追記内容

- **「共通パスワード（アクセス保護）」** セクションを追加。
  - 設定方法（ACCESS_PASSWORD）、採用A（本番未設定なら全体を閉じる）。
  - 利用の流れ（アクセス → /login → パスワード入力 → Cookie 発行 → 閲覧可能、アクセス解除で Cookie 削除）。
  - 除外パス、注意（NEXT_PUBLIC_ にしない・Cookie オプション・レート制限）。
- **Vercel 公開手順** の環境変数リストに `ACCESS_PASSWORD` を追加。
- **最終公開チェックリスト** の環境変数に「本番で ACCESS_PASSWORD を設定（共通パスワード保護を使う場合）」を追加。

---

## 8. Vercel に設定する環境変数一覧

| 変数名 | 必須 | 説明 |
|--------|------|------|
| ACCESS_PASSWORD | 共通パスワード保護を使う場合 | 共通パスワード。未設定なら本番では全ページ「ログイン無効」で閉じる。 |
| DEMO_MODE | 公開デモ時推奨 | `true` で変更系 API を無効化等。 |
| SETTINGS_PASSWORD | 設定画面を使う場合 | 設定画面のパスワード。 |
| AUTH_SECRET | 経理・Google ログインを使う場合 | `openssl rand -base64 32` で生成。 |
| AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET | Google ログインを使う場合 | OAuth のクライアント ID / シークレット。 |
| AUTH_URL | 本番で Google ログインを使う場合 | 本番の URL（例: https://your-app.vercel.app）。 |
| （任意）NEXT_PUBLIC_SALESFORCE_URL / NEXT_PUBLIC_PARTS_ORDER_URL | リンク表示用 | URL のみ。秘密情報は入れない。 |

---

## 9. 動作確認手順

1. **ACCESS_PASSWORD を設定して起動**
   - `.env.local` に `ACCESS_PASSWORD=test123` を追加。
   - `npm run dev` で起動し、`http://localhost:3000` にアクセス。
   - `/login` にリダイレクトされ、「アクセス保護」とパスワード入力欄が表示されること。
2. **ログイン**
   - パスワードに `test123` を入力して「ログイン」をクリック。
   - トップ（または callbackUrl）に遷移し、通常どおりアプリが使えること。
3. **アクセス解除**
   - サイドメニューの「アクセス解除」をクリック。
   - `/login` に戻り、再度パスワードなしでは他ページにアクセスできないこと。
4. **誤パスワード**
   - 間違ったパスワードで送信すると「パスワードが正しくありません」と表示されること。
5. **本番未設定の挙動（採用A）**
   - `NODE_ENV=production` かつ `ACCESS_PASSWORD` を未設定にした状態でビルド・起動し、任意のパスにアクセス。
   - `/login?unconfigured=1` に飛び、「管理者によりログインは無効化されています」と表示されること。

---

## 10. 公開前チェックポイント

- [ ] 本番で共通パスワード保護を使う場合、Vercel の環境変数に `ACCESS_PASSWORD` を設定した。
- [ ] 本番で使わない場合、未設定なら「ログイン無効」で全ページ閉じることを理解している（採用A）。
- [ ] パスワードを NEXT_PUBLIC_ やソースコードに書いていない。
- [ ] ログイン画面・アクセス解除・誤パスワード時の表示を確認した。
- [ ] 既存の Google ログイン・設定画面・DEMO_MODE が期待どおり動くことを確認した。

---

## この実装の制限事項

- **単一の共通パスワードのみ**: ユーザーごとのアカウントや権限はない。誰でも同じパスワードで入れる。
- **Cookie の検証**: middleware では Cookie の「値が 1 であること」のみ確認。署名付き Cookie にしていないため、同一オリジンで Cookie を書き換えられると理論上は bypass 可能（httpOnly のため XSS で書き換えは困難。同一オリジンのみなので第三者サイトからは設定不可）。
- **レート制限**: ログイン API には既存の共通レート制限のみ。ブルートフォース対策を強める場合は、このエンドポイント専用の厳しめの制限（例: 5 回/分/IP）を推奨。
- **Vercel の Edge**: middleware は Edge で動くため、Node の `crypto` は使っていない（Cookie の有無のみ判定）。照合は API Route（Node）で実施。

---

## より強い認証にする場合の改善案

1. **Cookie の署名**: AUTH_SECRET 等で HMAC 署名し、middleware または API で検証する（Edge では Web Crypto で検証が必要）。
2. **ログイン API の厳しめのレート制限**: 同一 IP で 5 回/分などに制限し、超過時は 429 や一時ブロック。
3. **アカウント認証への移行**: 共通パスワードではなく、ユーザーごとの ID/パスワードや OAuth で、既存の NextAuth と統合する。
4. **セッション有効期限の短縮**: Cookie の maxAge を 1 日などに短くし、再ログインを促す。
5. **監査ログ**: ログイン成功・失敗を（個人を特定しない範囲で）ログに残し、不正アクセス検知に利用する。

---

## Vercel 公開時の設定手順（初心者向け）

1. ブラウザで [Vercel](https://vercel.com) を開き、ログインする。
2. 「Add New Project」をクリックし、GitHub のリポジトリを選んでインポートする。
3. プロジェクトが作成されたら、画面上方の「Settings」をクリックする。
4. 左メニューの「Environment Variables」をクリックする。
5. 「Key」に `ACCESS_PASSWORD`、「Value」に使いたい共通パスワード（例: 英数字8文字以上）を入力する。
6. 「Save」をクリックする。
7. 必要に応じて `DEMO_MODE` を `true`、`SETTINGS_PASSWORD` や `AUTH_SECRET` なども設定する。
8. 画面上方の「Deployments」に戻り、最新のデプロイを「Redeploy」する（環境変数を追加した場合は再デプロイが必要）。
9. デプロイが終わったら、表示された URL（例: https://xxx.vercel.app）にアクセスする。
10. `/login` に飛んだら、設定したパスワードを入力して「ログイン」を押し、アプリが開くことを確認する。
