# 受付新規登録専用 OCR（赤枠ゾーンのみ）

## 絶対ルール

- **全文OCRをしない** / **全ページOCRをしない**
- **赤枠内のゾーン画像だけ**をクライアントで切り出し、API でゾーン単位に OCR
- primary では **full-page OCR は使わない**（ゾーン OCR のみ）
- 3秒以内に返す。超過時は partial として取得済み項目を返す。timeout でも取得済みを捨てない

## API

- **ゾーン定義取得**: `GET /api/ocr/zones?id=with_requester` または `id=without_requester`
- **ゾーン OCR**: `POST /api/ocr/intake-primary`（Body: FormData に `zone_1_reception_no`, `zone_2_requester`, … の画像を付与）

## ゾーン定義（赤枠のみ）

| ゾーン ID | 内容 |
|-----------|------|
| zone_1_reception_no | 修理受付番号 |
| zone_2_requester | ご依頼店名、フリガナ、ご担当者名、電話番号、FAX、依頼住所 |
| zone_3_schedule_payment | 受付日、訪問希望日、訪問希望時間、保証、支払方法 |
| zone_4_customer_model | お客様名、フリガナ、郵便番号、住所、自宅電話、優先電話、店舗No、店舗区分、型式名、型式コード、お申し出型名、銘板番号、ガス種 |
| zone_5_inquiry | 問合/依頼内容（raw のみ。分解は後段） |

赤枠外（読まない）: 最新修理履歴、社内連絡、修理委託料金、支払期日、点検登録情報、注意書き・フッター、AI要約、候補部品、原因候補など。

## 処理フロー

1. **クライアント**: PDF 1ページ目を描画 → ゾーン定義で 5 領域を切り出し → 各ゾーン画像を `intake-primary` に送信
2. **サーバー**: 各ゾーン画像を **並列** で Azure Document Intelligence に送信（ゾーンあたり最大 2s、全体で 2.5s で打ち切り）
3. ゾーンごとにラベルベースで項目を抽出しマージ
4. 3秒超過時は `status: "partial"` で取得済みを返却。timeout 時も取得済み項目は返す

## タイム・ログ

- **BUDGET_MS**: 3_000（全体目標）
- **ZONE_OCR_DEADLINE_MS**: 2_500（ゾーン OCR 並列の最大待機）
- **PER_ZONE_AZURE_MS**: 2_000（1ゾーンあたり Azure タイムアウト）
- 各ゾーンの処理時間（ms）を `timing.zones` で返却・ログ出力

## UI 表示

- OCR開始
- 主要項目抽出中
- **自動転記完了**（success）
- **一部のみ転記**（partial）
- **タイムアウト**
- **エラー**

## 設定ファイル

- `src/config/ocr-zones/with_requester.json`
- `src/config/ocr-zones/without_requester.json`

各ゾーンの正規化座標（0〜1）で `x`, `y`, `width`, `height` を定義。
