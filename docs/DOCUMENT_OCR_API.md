# Google Document AI を使った OCR API

## 概要

PDF アップロード時に、次の順で文字抽出を行います。

1. **Google Document AI** を優先利用（環境変数が設定されている場合）
2. **PDF 埋め込み文字**を抽出（テキスト付き PDF）
3. 文字が十分取れないときだけ **Tesseract OCR** を使用

---

## 対象ファイル（新規・修正）

| 種別 | パス | 説明 |
|------|------|------|
| 新規 | `src/app/api/ocr-google/route.ts` | `POST /api/ocr-google` の API ルート |
| 既存 | `src/lib/ocr-parse.ts` | 全文テキストを項目ごとにパース（`parseOcrText`） |
| 既存 | `src/lib/ocr.ts` | 1→2→3 の順でテキスト取得し、`parseOcrText` で `parsed` 取得 |
| 既存 | `.env.example` | 環境変数例 |
| 新規 | `docs/DOCUMENT_OCR_API.md` | 本ドキュメント |

---

## 環境変数

`.env.local` に以下を設定してください。

```env
GOOGLE_APPLICATION_CREDENTIALS=./pdf-run-56d4b1d5ed9b.json
GOOGLE_CLOUD_PROJECT_ID=pdf-run
DOCUMENT_AI_LOCATION=us
DOCUMENT_AI_PROCESSOR_ID=346fb519d01f586
```

- `GOOGLE_APPLICATION_CREDENTIALS`: サービスアカウントキー JSON のパス（プロジェクトルートからの相対パス可）
- `GOOGLE_CLOUD_PROJECT_ID`: GCP プロジェクト ID
- `DOCUMENT_AI_LOCATION`: Document AI のロケーション（`us` / `eu` 等）
- `DOCUMENT_AI_PROCESSOR_ID`: Document AI で作成したプロセッサの ID

---

## 必要ライブラリ（package.json）

```json
{
  "dependencies": {
    "@google-cloud/documentai": "^9.5.0"
  }
}
```

その他、既存の OCR まわりで使用しているもの:

- `pdfjs-dist`: PDF 埋め込みテキスト抽出
- `tesseract.js`: フォールバック用 OCR
- `map.prototype.getorinsertcomputed`: pdfjs 用ポリフィル

---

## API 仕様

### `POST /api/ocr-google`

**リクエスト**

- `Content-Type`: `multipart/form-data`
- フィールド名: `file`（PDF ファイル）
- 最大サイズ: 20MB

**レスポンス（JSON）**

成功時:

```ts
{
  "success": true,
  "source": "google-document-ai",
  "text": "抽出された全文テキスト",
  "parsed": { /* OcrResult: 出張修理依頼書の各項目 */ }
}
```

失敗時（HTTP 200 のまま `success: false`）:

```ts
{
  "success": false,
  "error": "エラーメッセージ"
}
```

- `parsed` は既存の `parseOcrText(text)` の戻り値（`OcrResult`）です。フロントでは `response.parsed` をそのままフォームなどに渡せます。

---

## フロントから fetch で呼ぶ例

```ts
async function runOcrWithGoogle(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/ocr-google", {
    method: "POST",
    body: formData,
  });
  const data = await res.json();

  if (!data.success) {
    console.error("OCR 失敗:", data.error);
    return null;
  }

  console.log("抽出元:", data.source); // "google-document-ai"
  console.log("全文:", data.text);
  console.log("パース結果:", data.parsed);

  // フォームなどにそのまま使う
  return data.parsed;
}

// 使用例（input[type=file] の onChange など）
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || file.type !== "application/pdf") return;
  const parsed = await runOcrWithGoogle(file);
  if (parsed) setFormState(parsed);
};
```

---

## 処理フロー（アプリ全体）

1. ユーザーが PDF を選択
2. `runPdfOcr(file)`（`src/lib/ocr.ts`）が呼ばれる
3. まず `fetch("/api/ocr-google", { method: "POST", body: formData })` を実行
4. `data.success && data.parsed` なら **その `parsed` を返して終了**
5. そうでなければ PDF 埋め込みテキスト抽出 → 足りなければ Tesseract → 最後に `parseOcrText(text)` で `parsed` を生成して返す

これにより「Google Document AI を優先 → 埋め込みテキスト → Tesseract」の順が保証されます。
