# 公開直前の検証結果

## 1. 検証結果

| 確認項目 | 結果 | 備考 |
|----------|------|------|
| 1. production build が通ること | ✅ 通過 | 初回は TypeScript エラーが複数あり。以下を修正してビルド成功。 |
| 2. README の環境変数だけで起動できること | ✅ 問題なし | 必須は `DEMO_MODE`（デモ時）, `SETTINGS_PASSWORD`（本番で設定画面を使う場合）, `AUTH_SECRET`（経理・Google ログインを使う場合）。それ以外（SMTP, Document AI 等）は未設定でも起動可能。 |
| 3. DEMO_MODE=true で変更系 API がすべて 403 | ✅ 問題なし | 設定ユーザー POST/PATCH/DELETE、メール設定 POST、OCR POST、fetch-bank POST、inbound/notify POST はいずれも 403 を返すことをコードで確認。 |
| 4. geocode が demo: true / demoNote を返し UI に注記 | ✅ 問題なし | `geocode/route.ts` で `demo: true`, `demoNote: "デモ用サンプル（東京駅付近）"` を返却。CaseForm の地図モーダルに「※ 表示位置はデモ用サンプル（東京駅付近）です。」を表示。 |
| 5. 設定画面が未設定時に閉じること | ✅ 問題なし | 本番かつ `SETTINGS_PASSWORD` 未設定時は `GET /api/auth/settings` が 401 + `unconfigured: true`。設定画面は「公開デモのため設定は利用できません」と表示。 |
| 6. .env.example と README の内容に矛盾がないこと | ✅ 解消 | `.env.example` に `NEXT_PUBLIC_SALESFORCE_URL` を追加し、README で触れている変数と揃えた。 |
| 7. 秘密情報が NEXT_PUBLIC_* に入っていないこと | ✅ 問題なし | 参照は `NEXT_PUBLIC_SALESFORCE_URL` と `NEXT_PUBLIC_PARTS_ORDER_URL` のみ。いずれも URL 用で、コード上は秘密は渡していない。.env.example に「URL のみ・秘密情報は入れない」と注記済み。 |
| 8. 公開デモ手順を 5〜10 手順で簡潔にまとめる | ✅ 対応済み | README に「公開デモ手順（5〜10 ステップ）」を 10 ステップで追記。 |

---

## 2. 問題があれば修正点（実施した修正）

- **fetch-bank/route.ts**: `map(({ _valid: _, ...p }) => p)` の TypeScript エラー（Binding element '_' implicitly has an 'any' type）を解消。`map` 内で `_valid` を除いたオブジェクトを返すように変更。
- **nodemailer 型**: ビルド用に `src/types/nodemailer.d.ts` を追加（`declare module "nodemailer"`）。
- **complete/page.tsx, CompletionFormSection.tsx**: `touchmove` の `removeEventListener` で `{ passive: false }` を渡すと型エラーになるため、リスナーを `(e2: Event)` にし、`removeEventListener` の第3引数を削除。
- **parts-store.ts**: `InboundRecord`, `OutboundRecord`, `VehiclePartRecord` を re-export して、inbound / inventory / outbound ページの型参照エラーを解消。
- **parts/inbound/page.tsx**: `partCost` が number 型のため `!== ""` 比較で型エラー。`!= null` のみの判定に変更（2箇所）。
- **settings/page.tsx**: `setDetailEditRoles` に `accounting: detailUser.accounting` を追加。
- **.env.example**: `NEXT_PUBLIC_SALESFORCE_URL` を追加し、README と整合。
- **README**: 「公開デモ手順（5〜10 ステップ）」を 10 ステップで追加。

---

## 3. このまま公開してよいか

**はい、このまま公開して問題ありません。**

- production build は成功している。
- README と .env.example は一致しており、公開デモに必要な環境変数と手順が書かれている。
- DEMO_MODE 時の変更系 403・参照系モック・設定未設定時の閉鎖・NEXT_PUBLIC_ の扱いはいずれもコードで担保済み。
- 公開前には、README の「最終公開チェックリスト」に沿って、Vercel 上で一度動作確認することを推奨します。

---

## 4. Vercel 公開手順の最終版

以下は README の「公開デモ手順（5〜10 ステップ）」と同一です。

1. リポジトリを GitHub に push する（`.env` / `.env.local` はコミットしない）。
2. [Vercel](https://vercel.com) にログインし、**Add New Project** から該当リポジトリをインポートする。
3. プロジェクトの **Settings → Environment Variables** を開く。
4. **DEMO_MODE** を `true` で追加する（必須・公開デモ用）。
5. **SETTINGS_PASSWORD** を設定する（設定画面を開くパスワード。未設定のままなら設定画面は「利用できません」表示）。
6. **AUTH_SECRET** を追加する（`openssl rand -base64 32` で生成。経理・Google ログインを使う場合に必須）。
7. 必要なら **NEXT_PUBLIC_SALESFORCE_URL** / **NEXT_PUBLIC_PARTS_ORDER_URL** にデモ用 URL を設定する（秘密情報は入れない）。
8. **Deploy** を実行し、本番 URL を確認する。
9. Google ログインを使う場合は、**Google Cloud Console** でリダイレクト URI に上記 URL を追加し、Vercel の **AUTH_URL** にその URL を設定して再デプロイする。
10. 最終公開チェックリスト（README 記載）で動作と設定を確認してから公開する。
