import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const prompt = (formData.get("prompt") as string) || "この内容を分析してください。";

  if (!file) {
    return Response.json({ error: "ファイルがありません" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mimeType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  if (!isImage && !isPdf) {
    return Response.json({ error: "画像またはPDFのみ対応しています" }, { status: 400 });
  }

  const content: Anthropic.MessageParam["content"] = isImage
    ? [
        {
          type: "image",
          source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 },
        },
        { type: "text", text: prompt },
      ]
    : [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        },
        { type: "text", text: prompt },
      ];

  const stream = await client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content }],
    system:
      "あなたは業務改善の専門家AIです。アップロードされたファイルを分析し、日本語で分かりやすく要点をまとめてください。箇条書きを活用し、実務に役立つ形式で出力してください。",
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
