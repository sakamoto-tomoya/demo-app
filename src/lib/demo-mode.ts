/**
 * 公開デモモード。DEMO_MODE=true のとき登録・更新・削除・OCR・外部API呼び出しを無効化またはモックする。
 */
export const isDemoMode = process.env.DEMO_MODE === "true";
