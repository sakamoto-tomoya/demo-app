/**
 * Difyナレッジ登録用の文書名を組み立てる。
 * 例: 2681236280_IC-730WA-R_点火後消火
 */
export function buildDifyDocumentName(params: {
  receptionNo?: string | null;
  caseId: string;
  model?: string | null;
  symptomCategory?: string | null;
}): string {
  const a = (params.receptionNo ?? params.caseId).trim();
  const b = (params.model ?? "").trim() || "—";
  const c = (params.symptomCategory ?? "").trim() || "—";
  return [a, b, c].join("_").replace(/\s+/g, "_");
}

/**
 * ブラウザでテキストの SHA-256 ハッシュを hex 文字列で返す。
 * 内容変更検知・再送スキップ用。
 */
export async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text)
    );
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return "";
}
