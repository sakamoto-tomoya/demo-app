/**
 * 完了案件ナレッジ用サンプル文書を Dify に登録する（create_by_text）。
 * 実行: npx tsx scripts/seed-completion-knowledge.ts
 */
import * as fs from "fs";
import * as path from "path";
import "./load-env";

const SAMPLE_PATH = path.join(process.cwd(), "scripts/seeds/completion-knowledge-sample.txt");

async function main() {
  const baseUrl = (process.env.DIFY_BASE_URL?.replace(/\/$/, "") || "http://localhost/v1").replace(/\/$/, "");
  const apiKey = process.env.DIFY_KNOWLEDGE_API_KEY?.trim();
  const datasetId =
    process.env.DIFY_KNOWLEDGE_DATASET_ID?.trim() || process.env.DIFY_DATASET_ID?.trim();

  if (!apiKey || !datasetId) {
    console.error("DIFY_KNOWLEDGE_API_KEY / DIFY_KNOWLEDGE_DATASET_ID が未設定です。");
    process.exit(1);
  }

  const text = fs.readFileSync(SAMPLE_PATH, "utf8");
  const name = `初期サンプル_${new Date().toISOString().slice(0, 10)}`;

  const createUrl = `${baseUrl}/datasets/${datasetId}/document/create_by_text`;
  const res = await fetch(createUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      name,
      text,
      indexing_technique: "high_quality",
      // セルフホスト版は custom のとき pre_processing_rules 必須のため automatic を使用
      process_rule: { mode: "automatic" },
    }),
  });

  const raw = await res.text();
  let data: { document?: { id?: string }; message?: string } = {};
  try {
    data = JSON.parse(raw || "{}") as typeof data;
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    console.error("create_by_text 失敗:", data?.message ?? raw.slice(0, 500));
    process.exit(1);
  }

  const id = data.document?.id;
  console.log("登録成功:", id ? `document.id=${id}` : raw.slice(0, 200));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
