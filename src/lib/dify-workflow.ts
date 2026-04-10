/**
 * Dify Workflow Run API 呼び出し（案件登録完了時のワークフロー実行用）
 * エンドポイント: POST …/v1/workflows/run（DIFY_CASE_WORKFLOW_URL で上書き可）
 *
 * 重要: チャットアプリの API キー（DIFY_APP_API_KEY / app-xxx は Chatbot 向け）を
 * workflows/run に渡すと 400「app mode matches…」になる。
 * ワークフローアプリで発行した API キー（通常も app- だがアプリ種別が Workflow）を使うこと。
 *
 * 推奨環境変数（先頭から優先）:
 * - DIFY_CASE_WORKFLOW_API_KEY … 案件連携専用ワークフローのキー
 * - DIFY_WORKFLOW_API_KEY … 汎用ワークフローキー
 * - DIFY_RECEPTION_CHECK_API_KEY … 受付チェックと同一ワークフローでよい場合
 * - DIFY_API_KEY … レガシー
 */

function defaultWorkflowRunUrl(): string {
  const base = process.env.DIFY_BASE_URL?.replace(/\/$/, "").trim();
  if (base) return `${base}/workflows/run`;
  return "https://api.dify.ai/v1/workflows/run";
}

export type DifyWorkflowRunInputs = {
  case_model: string;
  case_inquiry: string;
  case_search_text: string;
};

export type DifyWorkflowRunResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

/**
 * Dify Workflow を実行する。
 * ワークフロー用 API キーが未設定の場合は呼び出さず success: true を返す（案件登録は成功扱い）。
 */
export async function runDifyWorkflow(
  inputs: DifyWorkflowRunInputs,
  options?: { user?: string }
): Promise<DifyWorkflowRunResult> {
  const apiKey = (
    process.env.DIFY_CASE_WORKFLOW_API_KEY?.trim() ||
    process.env.DIFY_WORKFLOW_API_KEY?.trim() ||
    process.env.DIFY_RECEPTION_CHECK_API_KEY?.trim() ||
    process.env.DIFY_API_KEY?.trim() ||
    ""
  ).trim();

  if (!apiKey) {
    console.log(
      "[dify-workflow] ワークフロー用APIキー未設定（DIFY_CASE_WORKFLOW_API_KEY / DIFY_WORKFLOW_API_KEY / DIFY_RECEPTION_CHECK_API_KEY / DIFY_API_KEY）のためスキップ"
    );
    return { success: true, data: null };
  }

  const workflowUrl =
    process.env.DIFY_CASE_WORKFLOW_URL?.trim() ||
    process.env.DIFY_WORKFLOW_URL?.trim() ||
    defaultWorkflowRunUrl();

  const user = options?.user ?? "gyoumukannri-case";

  try {
    const res = await fetch(workflowUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: {
          case_model: String(inputs.case_model ?? "").trim(),
          case_inquiry: String(inputs.case_inquiry ?? "").trim(),
          case_search_text: String(inputs.case_search_text ?? "").trim(),
        },
        response_mode: "blocking",
        user,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = (data as { message?: string })?.message ?? `HTTP ${res.status}`;
      console.error("[dify-workflow] 実行失敗", res.status, message);
      return { success: false, error: message };
    }

    console.log("[dify-workflow] 実行完了");
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[dify-workflow] 例外", message);
    return { success: false, error: message };
  }
}
