# Dify チャット API 連携

## 概要

- **API Route**: `app/api/dify/route.ts`
- **メソッド**: POST のみ
- **環境変数**: `DIFY_BASE_URL`, `DIFY_API_KEY`（Vercel の Environment Variables に登録）

## 実装手順（短い説明）

1. **環境変数を設定**  
   Vercel の Environment Variables に `DIFY_BASE_URL`（例: `https://api.dify.ai/v1`）と `DIFY_API_KEY` を登録する。

2. **API を呼ぶ**  
   フロントから `POST /api/dify` に JSON で body を送る。  
   - `inputs` に相当する 6 項目: `case_search_text`, `case_model`, `case_inquiry`, `case_used_parts`, `case_work_detail`, `case_note`  
   - 任意: `query`（未指定時は「この案件の解決方法を教えて」を使用）

3. **回答の表示**  
   レスポンス JSON の `answer` を参照する。  
   動作確認は `fetch("/api/dify", …)` で上記 body を送る。

## フロントでの呼び出し例（抜粋）

```ts
const body = {
  case_search_text: "...",
  case_model: "...",
  case_inquiry: "...",
  case_used_parts: "...",
  case_work_detail: "...",
  case_note: "...",
  query: "この案件の解決方法を教えて", // 省略可
};

const res = await fetch("/api/dify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const data = await res.json();

// null/undefined 対策して answer を表示
const answerText = data?.answer != null ? String(data.answer) : "(回答なし)";
```
