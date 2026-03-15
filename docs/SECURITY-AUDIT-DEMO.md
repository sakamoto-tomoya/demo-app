# 公開デモ用 セキュリティ洗い出し

> **適用済み**: 以下の最小修正のうち、コードで対応済みのものは ✅ です。  
> - AUTH_SECRET 本番必須（`accounting-auth-server.ts` / `api/auth/accounting/route.ts`）  
> - fetch-bank: https のみ許可・URL長制限・エラーは汎用メッセージ（`api/accounting/fetch-bank/route.ts`）  
> - .env.example の具体値削除（プレースホルダー化）

## 1. 危険箇所：APIキー・秘密のデフォルト値

| 箇所 | 内容 |
|------|------|
| `src/lib/accounting-auth-server.ts` L8 | `process.env.AUTH_SECRET ?? "accounting-cookie-secret"` |
| `src/app/api/auth/accounting/route.ts` L10 | 上記と同様のフォールバック |

**影響**: 本番で `AUTH_SECRET` 未設定の場合、固定の弱い秘密でCookie署名が行われ、第三者による経理認証の偽造が可能になる。

**修正方法**: 本番では必ず `AUTH_SECRET` を設定する。フォールバックを使う場合は開発時のみとし、`NODE_ENV === "development"` のときだけデフォルトを許可する。

**優先順位**: 高

**最小修正案**:
```ts
function getSecret(): string {
  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production");
  }
  return secret || "accounting-cookie-secret";
}
```
※ 公開デモで「経理機能を使わない」なら、デモ用に `AUTH_SECRET` を Vercel の環境変数で設定するだけで可。

---

## 2. 危険箇所：.env 管理・露出

| 箇所 | 内容 |
|------|------|
| `.env.example` | `GOOGLE_APPLICATION_CREDENTIALS=./pdf-run-56d4b1d5ed9b.json`、`DOCUMENT_AI_PROCESSOR_ID=346fb519d01f586` など具体値が記載 |
| クライアント | `NEXT_PUBLIC_SALESFORCE_URL` / `NEXT_PUBLIC_PARTS_ORDER_URL` は意図的に公開用 |

**影響**: `.env.example` にプロジェクトIDやファイル名がそのまま書かれていると、別環境で流用されたり、実運用の推測材料になる。`NEXT_PUBLIC_*` はバンドルに含まれるため、設定値は「公開してよいURLだけ」にする必要がある。

**修正方法**:
- `.env.example` はプレースホルダーにし、実値や実プロジェクト名は書かない（例: `GOOGLE_CLOUD_PROJECT_ID=your-project-id`）。
- 秘密情報はすべて `NEXT_PUBLIC_` なしの環境変数にし、サーバー側のみで参照する（現状の AUTH_* / SMTP_* 等は問題なし）。

**優先順位**: 中

**最小修正案**: `.env.example` の `GOOGLE_APPLICATION_CREDENTIALS` / `GOOGLE_CLOUD_PROJECT_ID` / `DOCUMENT_AI_PROCESSOR_ID` を `your-*` や空にしたプレースホルダーに変更。

---

## 3. 危険箇所：フロント側での秘密情報露出

| 箇所 | 内容 |
|------|------|
| `src/app/settings/page.tsx` | 設定ユーザー一覧で「本人または管理者」にパスワードを表示（API経由でマスク済み） |
| 設定 API `GET /api/settings/users` | 本人/管理者にだけ `password` を返している。管理者が全員のパスワードを見られる |

**影響**: デモで管理者としてログインした状態で設定を開くと、登録ユーザーの平文パスワードが表示される。第三者に画面を見られると漏洩する。

**修正方法**: パスワードは表示せず「登録済み」などの表示にとどめる。必要な場合は「パスワード再設定」のみ許可し、平文表示は廃止する。

**優先順位**: デモでは中（デモ用アカウントのみなら許容可）。本番では高。

**最小修正案**: デモ用なら「設定画面でパスワードを表示しない」オプションを追加するか、表示部分を `********` 固定にする。

---

## 4. 危険箇所：危険な管理機能

| 箇所 | 内容 |
|------|------|
| `/settings` | 1パスワードで全設定にアクセス。ユーザー追加・削除・役割変更・メール設定の保存が可能 |
| `/api/accounting/fetch-bank` | 経理ロールで「任意URLにサーバーからGET」を実行可能（SSRF） |

**影響**:
- 設定パスワードが漏れると、ユーザー管理・メール設定を乗っ取られる。
- fetch-bank の URL に `http://169.254.169.254/`（クラウドメタデータ）や社内URLを指定されると、サーバー経由で内部情報が取得される可能性がある。

**修正方法**:
- 設定はデモでは「閲覧のみ」や「パスワード必須＋強パス」にし、本番では IP 制限や MFA を検討。
- fetch-bank は「許可するホストのホワイトリスト」を設けるか、`https:` かつ特定ドメインのみに制限する。

**優先順位**: 高（fetch-bank）、中（設定）

**最小修正案（fetch-bank）**:
```ts
const url = new URL(body.url.trim());
if (url.protocol !== "https:") {
  return NextResponse.json({ error: "https のURLのみ指定できます", payments: [] }, { status: 400 });
}
// 必要なら: 許可ホストのホワイトリストで url.hostname をチェック
```

---

## 5. 危険箇所：本番データ利用

| 箇所 | 内容 |
|------|------|
| 案件・部品・経費・銀行入金データ等 | すべて `localStorage` に保存。Vercel はサーバーレスでローカル永続化なし |

**影響**: デモでは「ブラウザごと・端末ごと」のデータになる。本番データベースや本番APIは使っていないため、本番データの誤利用リスクは低い。ただし localStorage は消えやすく、同一オリジンなら他タブからも読める。

**修正方法**: デモのままなら「データは端末内のみ」「消える場合がある」と注意書きする。本番化する場合は DB や API で永続化し、localStorage はキャッシュ用途に限定する。

**優先順位**: 低（デモ用途なら現状で可）

**最小修正案**: README やデモ画面に「このデモのデータはお使いのブラウザ内にのみ保存されます」と明記する。

---

## 6. 危険箇所：エラーメッセージ漏洩

| 箇所 | 内容 |
|------|------|
| `src/app/api/accounting/fetch-bank/route.ts` L80 | `err instanceof Error ? err.message : "取得に失敗しました"` をそのまま JSON で返却 |
| `src/app/api/ocr-google/route.ts` | `fail("...")` で設定不足時などメッセージを返している（設定値は含めないこと） |
| 各種 API | `console.error` でスタックをサーバーログに出力（ユーザーには返していない） |

**影響**: fetch-bank で `fetch` が失敗したとき、ネットワークエラーや「ECONNREFUSED」などがそのまま返ると、内部構成の推測に使われる。OCR は「Google Document AI が未設定です」などは許容範囲。

**修正方法**: ユーザーに返す `error` は汎用メッセージに統一する（例: 「取得に失敗しました。URLとネットワークをご確認ください」）。詳細はサーバーログのみ。

**優先順位**: 中

**最小修正案（fetch-bank）**:
```ts
} catch (err) {
  console.error("[fetch-bank]", err);
  return NextResponse.json({ error: "取得に失敗しました。URLをご確認ください。", payments: [] }, { status: 200 });
}
```

---

## 7. 危険箇所：入力バリデーション不足

| 箇所 | 内容 |
|------|------|
| `/api/accounting/fetch-bank` | `url` の形式・長さ・スキームのチェックが不足（SSRF の原因の一つ） |
| 経費・案件フォーム | 金額や日付の範囲・形式チェックが不十分な箇所がある可能性 |
| 設定ユーザー登録 | メール形式・パスワード長などのバリデーション |

**影響**: 不正な URL で SSRF、不正な数値でオーバーフローや表示崩れ、短いパスワードで設定が脆弱化する可能性。

**修正方法**: URL は `https` のみ許可し、長さ上限とホスト制限を設ける。金額・日付はサーバー側でも型・範囲チェック。パスワードは最小長を強制する。

**優先順位**: 高（URL）、中（他）

**最小修正案**: fetch-bank で `url` を `URL` オブジェクトでパースし、`protocol === "https:"` かつ長さ上限（例: 2048）をチェックする。

---

## 8. 危険箇所：認証不足

| 箇所 | 内容 |
|------|------|
| `GET/POST /api/geocode` | 認証なし。誰でも住所・郵便番号でジオコード取得可能 |
| `POST /api/ocr-google` | 認証なし。誰でも PDF を送ると Document AI が叩かれ、API 利用料が発生 |
| `GET/POST /api/auth/settings` | パスワード未設定時は常に許可（`return true`） |
| `/settings` 画面 | 上記の通り 1 パスワードで全設定操作可能 |

**影響**: デモ公開時に、geocode の悪用（大量リクエスト）や OCR の無認証利用で Google の課金が増える。設定パスワード未設定なら誰でも設定変更可能。

**修正方法**:
- デモでは OCR を無効化するか、環境変数で「デモモード」にし、OCR/geocode をスキップまたはモックにする。
- 設定は「デモ用パスワードを必ず設定する」（Vercel の `SETTINGS_PASSWORD`）。
- 本番では NextAuth セッションや API キーで geocode/ocr を保護する。

**優先順位**: 高（OCR＝課金）、中（geocode・設定）

**最小修正案**:
- Vercel の環境変数で `SETTINGS_PASSWORD` を必ず設定。
- デモで Document AI を使わない場合は、`GOOGLE_CLOUD_PROJECT_ID` や `DOCUMENT_AI_PROCESSOR_ID` を未設定にし、OCR API が「未設定」で早期 return する現状のままにする。

---

## 9. 危険箇所：CORS・XSS の懸念

| 箇所 | 内容 |
|------|------|
| CORS | Next.js の API Route はデフォルトで同一オリジンのみ。明示的には未設定のため、必要なら `vercel.json` や middleware で確認 |
| XSS | `MapView.tsx` の `escapeHtml` は `textContent` 経由で `innerHTML` を取得しており、エスケープ目的で正しく使えている。`return-forms` の `document.write(html)` は自前生成 HTML の書き出しで、ユーザー入力をそのまま含めない設計ならリスクは低い |
| レシート画像 | 経費の `receiptDataUrl` は Data URL をそのまま `<img src={}>` で表示。Data URL に script は載らないため、img 表示のみなら XSS リスクは低い |

**影響**: 現状、致命的な XSS や CORS の不具合は見当たらない。`document.write` にユーザー入力を渡さないよう注意。

**修正方法**: ユーザー入力は必ず `textContent` や React のデフォルトエスケープで表示する。`document.write` には信頼できるテンプレートのみ渡す。

**優先順位**: 低（現状維持で可）。新機能で HTML を組み立てる場合はエスケープを徹底。

**最小修正案**: 特になし。新規実装時のみチェックリストに「表示文字列はエスケープ済みか」を追加。

---

## 10. 危険箇所：Vercel 公開時の問題

| 箇所 | 内容 |
|------|------|
| データ永続化 | `data/` のファイル（settings-password, settings-users.json 等）は Vercel のサーバーレスでは読み書き不可。デプロイごとに消える |
| 環境変数 | 秘密はすべて Vercel の Environment Variables に設定し、`.env` はコミットしない（.gitignore で `.env*` 除外済み） |
| AUTH_URL | 本番ドメインを `AUTH_URL` に設定しないと Google ログインのリダイレクトが失敗する |

**影響**: デモで「設定パスワード」や「ユーザー一覧」をファイルに保存している場合、Vercel 上では動かないか、再デプロイで消える。Google ログインは Vercel の URL を Google の OAuth に登録し、`AUTH_URL` にその URL を設定する必要がある。

**修正方法**:
- デモで設定機能を使う場合: 設定パスワードとユーザーは環境変数や外部DBで管理するか、デモでは「設定は使わない」とし、ログインのみ行う。
- Vercel では `data/` に書き込まない設計にする（設定ユーザーは DB や VercEL KV 等に移すか、デモでは無効化）。

**優先順位**: 高（Vercel で動かすなら必須）

**最小修正案**:
- デモ用に「設定パスワード」を環境変数 `SETTINGS_PASSWORD` のみで判定し、ファイルがなくても動くようにする（既に `getEffectivePassword()` は env をフォールバックしている。Vercel では `data/` が存在しないため、結果的に env のみになる）。
- 設定「ユーザー一覧」は Vercel では永続化されないため、デモでは「ユーザー登録は利用不可」と注意書きするか、デモ用に別ストア（Vercel KV 等）を検討する。

---

## まとめ：優先順位と最小修正案（公開デモ用）

| 優先順位 | 項目 | 最小修正 |
|----------|------|----------|
| 高 | AUTH_SECRET のデフォルト値 | 本番では必須にするか、Vercel で `AUTH_SECRET` を設定 |
| 高 | fetch-bank の SSRF | URL を `https:` のみ許可し、エラーは汎用メッセージで返す |
| 高 | OCR の認証なし | デモで Document AI を使わない場合は環境変数未設定のまま（現状で早期 return） |
| 高 | Vercel での data/ 永続化 | デモでは設定ユーザーを「使わない」または README で注意。SETTINGS_PASSWORD は環境変数のみで運用 |
| 中 | .env.example の具体値 | プレースホルダーに変更 |
| 中 | 設定画面のパスワード表示 | デモでは許容するか、表示を `********` に変更 |
| 中 | エラーメッセージ（fetch-bank） | 返却は汎用メッセージに統一 |
| 低 | 本番データ・localStorage | README に「デモのデータはブラウザ内のみ」と明記 |
| 低 | XSS/CORS | 現状のまま。新機能でエスケープを徹底 |

上記の「高」と「中」の最小修正を適用すれば、公開デモとしてのセキュリティリスクをある程度抑えられます。
