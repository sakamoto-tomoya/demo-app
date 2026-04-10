/**
 * Dify POST /v1/workflows/run（blocking）のレスポンスから本文を取り出す。
 * ワークフローの出力変数名はアプリごとに異なるため、よくあるキーを順に試す。
 */
export function extractWorkflowAnswerText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  if (typeof d.answer === "string" && d.answer.trim() !== "") return d.answer;

  const inner = d.data;
  if (inner && typeof inner === "object") {
    const dataObj = inner as Record<string, unknown>;
    if (typeof dataObj.answer === "string" && dataObj.answer.trim() !== "") return dataObj.answer;

    const outputs = dataObj.outputs;
    if (outputs && typeof outputs === "object") {
      const o = outputs as Record<string, unknown>;
      for (const k of ["answer", "text", "output", "result", "response", "reply"]) {
        const v = o[k];
        if (typeof v === "string" && v.trim() !== "") return v;
      }
    }
  }

  const topOutputs = d.outputs;
  if (topOutputs && typeof topOutputs === "object") {
    const o = topOutputs as Record<string, unknown>;
    for (const k of ["answer", "text", "output", "result", "response"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim() !== "") return v;
    }
  }

  return null;
}
