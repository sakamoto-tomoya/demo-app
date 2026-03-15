# 公開直前の最終仕上げ

## 1. 最終追加修正点

| 項目 | 内容 |
|------|------|
| レート制限の注記 | README および `rate-limit.ts` に「デモ用簡易制限（メモリ実装）、本番は Redis 等推奨」を明記。 |
| ジオコードのデモ表示 | モック返却時にレスポンスに `demo: true` と `demoNote` を付与。CaseForm の地図モーダルに「※ 表示位置はデモ用サンプル（東京駅付近）です。」を表示。 |
| DEMO_MODE API 統一 | **変更系**はすべて **403**（設定ユーザー POST/PATCH/DELETE、メール設定 POST、OCR POST、fetch-bank POST、inbound/notify POST）。**参照系**は**モック**（geocode GET はモック座標 + `demo: true`）。 |
| ログの個人情報等 | `console.error` で `err` オブジェクト全体を出さず、`err instanceof Error ? err.message : "error"` のみ出力するよう変更（スタック・リクエスト内容の漏洩を防止）。 |
| README 拡充 | 「Vercel 公開手順」「公開デモ運用時の注意」を追記。レート制限は「デモ用簡易・本番は Redis 等推奨」と明記。 |
| チェックリスト統合 | GitHub push 前と Vercel デプロイ前を 1 つにまとめた「最終公開チェックリスト」を README に記載。 |

---

## 2. 修正ファイル

| ファイル | 変更内容 |
|----------|----------|
| `src/app/api/geocode/route.ts` | モック時に `demo: true`, `demoNote` をレスポンスに追加。 |
| `src/components/CaseForm.tsx` | ジオコード応答の `demo` を state で保持し、地図モーダルに「デモ用サンプル」の注記を表示。 |
| `src/app/api/ocr-google/route.ts` | DEMO_MODE 時は 200 ではなく **403** で返却。 |
| `src/app/api/parts/inbound/notify/route.ts` | DEMO_MODE 時は 200 ではなく **403** で返却。 |
| `src/app/api/accounting/fetch-bank/route.ts` | `console.error` でメッセージのみ出力。 |
| `src/app/api/ocr-google/route.ts` | `console.error` でメッセージのみ出力（`err` オブジェクトを渡さない）。 |
| `src/app/api/settings/email/route.ts` | 同上。 |
| `src/app/api/settings/users/route.ts` | 同上。 |
| `src/app/api/parts/inbound/notify/route.ts` | 同上。 |
| `src/lib/rate-limit.ts` | コメントで「デモ用簡易・本番は Redis 等推奨」を明記。 |
| `README.md` | Vercel 公開手順、公開デモ運用時の注意、レート制限の注記、最終公開チェックリストを追加。 |

---

## 3. 変更コード（要点）

- **geocode モック**
  - `return NextResponse.json({ lat: 35.6812, lng: 139.7671, demo: true, demoNote: "デモ用サンプル（東京駅付近）" });`
- **CaseForm**
  - `addressMapDemo` state を追加。`data.demo` を set。地図表示時に `addressMapDemo && <p>※ 表示位置はデモ用サンプル（東京駅付近）です。</p>`。
- **DEMO_MODE 変更系を 403 に統一**
  - ocr-google: `NextResponse.json({ success: false, error: "デモモードではOCRを利用できません。" }, { status: 403 })`
  - inbound/notify: `NextResponse.json({ sent: false, reason: "デモモードではメール送信できません。" }, { status: 403 })`
- **console.error の sanitize**
  - `console.error("[tag]", err instanceof Error ? err.message : "error");` に統一（`err` そのものは渡さない）。
- **README**
  - 「Vercel 公開手順」3 ステップ、「公開デモ運用時の注意」でレート制限を「デモ用簡易・本番は Redis 等推奨」と明記。「最終公開チェックリスト」で push 前・デプロイ前を 1 つに統合。

---

## 4. 最終公開チェックリスト

以下を満たしてから **GitHub に push** し、Vercel で **Deploy** してください。

- [ ] **リポジトリ**
  - [ ] `.env` / `.env.local` をコミットしていない（`.gitignore` に `.env*` があることを確認）
  - [ ] 秘密情報（API キー・パスワード）がソースコードに直書きされていない
- [ ] **環境変数（Vercel）**
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

※ このチェックリストは README の「最終公開チェックリスト」と同一です。
