/**
 * 部品返品伝票・返品シール ドメイン型定義
 * プロンプト指定のデータ型に準拠
 */

/** 元データー行（入力データ） */
export type SourceRow = {
  rowNo: number;
  partNumber: string;
  completedAt: string;
  partName: string;
  quantity: number;
  staffName: string;
  receptionNo: string;
  orderNo: string;
  billingType: string;
  repairSlipNo: string;
};

/** 検証エラー（行番号・項目・メッセージ） */
export type ValidationError = {
  rowNo: number;
  field: string;
  message: string;
};

/** 部品伝票 1行分 */
export type PartsSlipItem = {
  sequenceNo: number;
  partName: string;
  partNumber: string;
  quantity: number;
  orderNo: string;
  receptionNo: string;
  completedAt: string;
  staffName: string;
  repairSlipNo: string;
};

/** 部品伝票 1ページ（担当者単位・最大4件） */
export type PartsSlipPage = {
  pageNo: number;
  staffName: string;
  items: PartsSlipItem[];
};

/** 返品シール（返品ラベル）1枚分 */
export type ReturnLabelItem = {
  receptionNo: string;
  repairSlipNo: string;
  orderNo: string;
  partNumber: string;
  partName: string;
  completedAt: string;
};

/** 返品シール 1ページ（8枚） */
export type ReturnLabelPage = {
  pageNo: number;
  items: ReturnLabelItem[];
};

/** 請求区分：無償・無償Y・無料 を対象（対象となる値の一覧） */
export const BILLING_TYPES_TARGET = ["無償", "無償Y", "無料"] as const;

export function isTargetBillingType(value: string): boolean {
  const t = String(value ?? "").trim();
  return (BILLING_TYPES_TARGET as readonly string[]).includes(t);
}

/** 部品伝票：1ページあたりの最大件数 */
export const PARTS_SLIP_ITEMS_PER_PAGE = 4;

/** 返品シール：1ページあたりの枚数 */
export const RETURN_LABEL_ITEMS_PER_PAGE = 8;
