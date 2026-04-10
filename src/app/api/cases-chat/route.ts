import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getTursoClient } from "@/lib/turso";
import type { CaseRecord } from "@/lib/types";

const client = new Anthropic();

/** 完了案件のナレッジをテキスト化 */
function buildKnowledge(cases: CaseRecord[]): string {
  const completed = cases.filter(
    (c) => c.status === "completed" && c.completionDetail?.is_completed
  );

  if (completed.length === 0) return "完了案件データはまだありません。";

  return completed
    .map((c, i) => {
      const d = c.completionDetail!;
      return [
        `【案件${i + 1}】`,
        `器具分類: ${d.category || "不明"}`,
        `型式: ${d.model || c.modelName || "不明"}`,
        `症状分類: ${d.symptom_category || "不明"}`,
        `問合内容: ${d.inquiry_content || c.inquiryContent || ""}`,
        `確定原因: ${d.confirmed_cause || ""}`,
        `部品品番: ${d.part_number || ""} ${d.part_name || ""}`,
        `作業内容: ${d.work_detail || ""}`,
        `解決要約: ${d.solution_summary || ""}`,
        `作業結果: ${d.work_result || ""}`,
      ]
        .filter((line) => !line.endsWith(": ") && !line.endsWith(":"))
        .join("\n");
    })
    .join("\n\n");
}

export async function POST(req: NextRequest) {
  const { messages, currentCase } = await req.json();

  // 完了案件をDBから取得
  let knowledge = "";
  try {
    const db = getTursoClient();
    const res = await db.execute(
      `SELECT case_json FROM case_records ORDER BY updated_at DESC LIMIT 200`
    );
    const cases: CaseRecord[] = res.rows
      .map((r) => {
        try { return JSON.parse(r.case_json as string) as CaseRecord; } catch { return null; }
      })
      .filter(Boolean) as CaseRecord[];
    knowledge = buildKnowledge(cases);
  } catch {
    knowledge = "データベースへの接続に失敗しました。";
  }

  // 現在の入力内容
  const currentInfo = currentCase
    ? `\n【現在入力中の案件】\n型式: ${currentCase.modelName || "未入力"}\n症状: ${currentCase.inquiryContent || "未入力"}\nガス種: ${currentCase.gasType || "未入力"}`
    : "";

  const systemPrompt = `あなたは修理・メンテナンス業務の現場AIアシスタントです。
以下の3つの役割を担います。

【役割1】過去完了案件ナレッジを参照して回答
過去の完了案件データをもとに、「この症状の原因は？」「同じ型式の修理実績は？」などの質問に答えます。

【役割2】フォーム入力補助
入力フォームの各項目について「何を入力すればいい？」という質問に丁寧に答えます。
- 修理受付番号：パロマからの依頼書に記載された番号
- ご依頼店名：依頼元の会社・店舗名
- お客様名：実際に訪問するエンドユーザー名
- 問合/依頼内容：症状・使用年数・請求先などを記入
- ステータス：案件の進捗状況

【役割3】一般的な修理対応支援
ガス器具（給湯器・コンロ・湯沸し器など）の修理対応について、技術的なアドバイスを提供します。

【過去完了案件ナレッジ】
${knowledge}
${currentInfo}

回答は日本語で、簡潔かつ実用的に。技術者が現場で素早く参照できる形式にしてください。`;

  const stream = await client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
