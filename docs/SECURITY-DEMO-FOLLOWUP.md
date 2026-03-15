# 公開デモ「事故りにくい状態」追加対応

## 1. 追加で危険だった箇所

| 項目 | 危険箇所 | 内容 |
|------|----------|------|
| NEXT_PUBLIC_ 総点検 | `NEXT_PUBLIC_SALESFORCE_URL`, `NEXT_PUBLIC_PARTS_ORDER_URL` | 現状は URL のみで秘密情報なし。ただし .env.local に実運用の Salesforce URL が入っている場合はデモ用に差し替え推奨。 |
| Supabase service_role | プロジェクト内 | **使用なし**。Supabase は未使用のため service_role の露出リスクはなし。 |
| 設定画面の未認証・未設定 | `/api/auth/settings` GET, `requireSettingsAuth` | 本番でパスワード未設定のとき「誰でも許可」になっており、設定が外部に公開されていた。 |
| 設定変更APIの直叩き | `/api/settings/users`, `/api/settings/email` | 認証は必須だったが、本番でパスワード未設定だと Cookie なしでも 200 で通過していた。 |
| 登録・OCR・外部API | 各 API | DEMO_MODE がなく、誰でも OCR・geocode・fetch-bank・メール送信を叩けて課金・送信が発生し得た。 |
| レート制限 | 全 API | なし。大量リクエストで負荷・課金・DoS の懸念。 |
| 入力文字数・バリデーション | 設定ユーザー・メール設定・geocode | 長さ制限や形式チェックが不足していた。 |
| 実データ | NEXT_PUBLIC_* URL | 実運用 URL をそのままデモに貼ると誤操作のリスク。 |

---

## 2. 優先順位

| 優先度 | 内容 |
|--------|------|
| 高 | 本番で設定パスワード未設定時に設定を許可しない |
| 高 | DEMO_MODE で登録・更新・削除・OCR・外部API・メール送信を無効化／モック |
| 高 | 設定変更APIは認証必須のまま、未設定時は認証失敗に統一 |
| 中 | API にレート制限を追加 |
| 中 | 入力文字数制限・バリデーション追加 |
| 低 | README に公開デモ時の注意点を追記 |

---

## 3. 最小修正案（実施済み）

- **設定の本番保護**: 本番かつ `SETTINGS_PASSWORD`（およびファイル）未設定のときは `GET/POST /api/auth/settings` を 401 にし、設定画面は「設定は利用できません」表示。
- **DEMO_MODE**: `DEMO_MODE=true` のとき  
  - 設定ユーザー POST/PATCH/DELETE → 403  
  - メール設定 POST → 403  
  - OCR POST → エラーメッセージで利用不可  
  - geocode GET → 東京駅のモック座標を返す  
  - fetch-bank POST → 403  
  - inbound/notify POST → 送信せず「デモのため送信できません」で 200  
- **レート制限**: 全対象 API で `checkRateLimit(request)` を先に実行し、超過時 429。
- **入力検証**: 設定ユーザー（名前・メール・パスワードの長さ・メール形式）、メール設定（host/user/from 長さ・port 範囲）、geocode（クエリ長）。
- **README**: 「公開デモ時の注意点」を追記。

---

## 4. 修正対象ファイル

| ファイル | 変更内容 |
|----------|----------|
| `src/lib/demo-mode.ts` | 新規。`isDemoMode` を export。 |
| `src/lib/rate-limit.ts` | 新規。`checkRateLimit(request)` で 429 または null。 |
| `src/lib/settings-auth.ts` | 新規。`requireSettingsAuth()` を共通化し、本番でパスワード未設定なら false。 |
| `src/app/api/auth/settings/route.ts` | GET で本番かつ未設定なら 401 + `unconfigured: true`。POST も未設定なら 401。レート制限追加。 |
| `src/app/api/settings/users/route.ts` | `requireSettingsAuth` を共通化、DEMO_MODE で POST/PATCH/DELETE を 403、レート制限・入力長・メール形式。 |
| `src/app/api/settings/email/route.ts` | `requireSettingsAuth` を共通化、DEMO_MODE で POST を 403、レート制限・入力長・port 範囲。 |
| `src/app/settings/page.tsx` | 401 かつ `unconfigured` のとき「設定は利用できません」表示（`unconfigured` 状態を追加）。 |
| `src/app/api/ocr-google/route.ts` | DEMO_MODE で利用不可、レート制限。 |
| `src/app/api/geocode/route.ts` | DEMO_MODE でモック座標、レート制限、クエリ長制限。 |
| `src/app/api/accounting/fetch-bank/route.ts` | DEMO_MODE で 403、レート制限。 |
| `src/app/api/parts/inbound/notify/route.ts` | DEMO_MODE で送信せず 200、レート制限。 |
| `.env.example` | `DEMO_MODE` と SETTINGS_PASSWORD の説明を追記。 |
| `README.md` | 「公開デモ時の注意点」を追記。 |

---

## 5. 変更コード（要点）

- **本番で設定を閉じる（auth/settings GET）**
  - `if (process.env.NODE_ENV === "production" && !getEffectivePassword()) return NextResponse.json({ ok: false, unconfigured: true }, { status: 401 });`
- **DEMO_MODE 判定**
  - `if (isDemoMode) return NextResponse.json({ error: "デモモードでは…" }, { status: 403 });` またはモック返却。
- **レート制限**
  - 各 API 先頭で `const rate = checkRateLimit(request); if (rate) return rate;`
- **入力検証（例: 設定ユーザー）**
  - 名前 ≤ 100、メール ≤ 256、パスワード ≤ 200、メール形式の正規表現チェック。

---

## 6. 公開前チェックリスト

- [ ] **環境変数**
  - [ ] 公開デモ用に `DEMO_MODE=true` を設定している
  - [ ] 本番で `SETTINGS_PASSWORD` を設定している（設定画面を「利用不可」のままにする場合は未設定でよい）
  - [ ] `AUTH_SECRET` を本番で設定している（経理・Google ログインを使う場合）
  - [ ] `NEXT_PUBLIC_*` に秘密情報（API キー・service_role 等）が含まれていない
- [ ] **設定画面**
  - [ ] 本番でパスワード未設定のとき、設定画面で「設定は利用できません」と表示されることを確認した
  - [ ] パスワード設定時、正しいパスワードでのみ設定内容が表示・変更できることを確認した
- [ ] **DEMO_MODE**
  - [ ] 設定ユーザーの登録・変更・削除が 403 になることを確認した
  - [ ] メール設定の保存が 403 になることを確認した
  - [ ] OCR が「デモモードでは利用できません」となることを確認した
  - [ ] ジオコードがモック座標（東京駅付近）を返すことを確認した
  - [ ] 入金取得（fetch-bank）が 403 になることを確認した
  - [ ] 入庫通知メールが送信されず「デモのため送信できません」となることを確認した
- [ ] **レート制限**
  - [ ] 短時間に大量リクエストで 429 が返ることを確認した（任意）
- [ ] **データ・URL**
  - [ ] デモ用に `NEXT_PUBLIC_SALESFORCE_URL` / `NEXT_PUBLIC_PARTS_ORDER_URL` をデモ用 URL または空にしている（実運用URLのままにしない）
- [ ] **ドキュメント**
  - [ ] README の「公開デモ時の注意点」を読み、運用と一致している
