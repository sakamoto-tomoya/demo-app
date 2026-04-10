/**
 * 受付情報ベースの Dify チャット用クエリ本文を組み立てる。
 * 完了登録前の事前検索用途（型式名・内容で過去案件ナレッジを参照し、
 * 想定原因・事前確認ポイント・改善方法・交換候補部品を返す）。
 */

export type DifyChatQueryIntent = "solution" | "cause" | "parts";

const INTENT_SUFFIX: Record<DifyChatQueryIntent, string> = {
  solution: "上記について、解決方法・改善方法を中心に回答してください。",
  cause: "上記について、想定原因を中心に回答してください。",
  parts: "上記について、交換候補部品を中心に回答してください。",
};

export interface ReceptionQueryParams {
  /** 型式名 */
  modelName: string;
  /** お申し出型式名 */
  reportedModelName: string;
  /** ガス種 */
  gasType: string;
  /** 内容（症状・使用年数・請求先等） */
  content: string;
  /** 質問意図（ボタン別） */
  intent: DifyChatQueryIntent;
}

function trim(s: string): string {
  return (s ?? "").trim();
}

/**
 * 受付情報をまとめた1つの検索文（送信本文）を組み立てる。
 * 類似案件が少ない場合でも、型式名と内容から一般的な候補を返すよう指示する。
 */
export function buildReceptionQueryText(params: ReceptionQueryParams): string {
  const { modelName, reportedModelName, gasType, content, intent } = params;
  const a = trim(modelName);
  const b = trim(reportedModelName);
  const c = trim(gasType);
  const d = trim(content);

  const blocks: string[] = [
    "案件の事前検索をしてください。",
    "",
    "【型式名】",
    a || "（未入力）",
    "",
    "【お申し出型式名】",
    b || "（未入力）",
    "",
    "【ガス種】",
    c || "（未入力）",
    "",
    "【内容】",
    d || "（未入力）",
    "",
    "この受付情報に近い過去の完了案件を参考にして、",
    "1. 想定原因",
    "2. 事前確認ポイント",
    "3. 改善方法の候補",
    "4. 交換候補部品",
    "を回答してください。",
    "",
    "類似案件が少ない場合でも、型式名と内容から一般的に考えられる候補を簡潔に提示してください。",
    "",
    INTENT_SUFFIX[intent],
  ];

  return blocks.join("\n").trim();
}
