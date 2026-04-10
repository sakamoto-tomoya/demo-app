/**
 * 座標ベースOCR：項目ごと切り出し・補正・信頼度の型定義
 */

export type ConfidenceLevel = "high" | "medium" | "low";

export type FieldType =
  | "customer_name"
  | "customer_furigana"
  | "phone"
  | "postal_code"
  | "address"
  | "model"
  | "serial_number"
  | "error_code"
  | "gas_type"
  | "manufacturer"
  | "product_category"
  | "preferred_date"
  | "preferred_time"
  | "inquiry"
  | "symptom"
  | "internal_note"
  | "note"
  | "reception_no"
  | "request_store"
  | "request_contact"
  | "request_fax"
  | "request_address"
  | "reception_date"
  | "plain"; // その他・ルール未定義

/** 抽出結果1項目 */
export type ExtractedField = {
  key: string;
  label: string;
  rawText: string;
  normalizedText: string;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  needsReview: boolean;
  sourcePage?: number;
};

/** テンプレート1項目の定義（座標は正規化 0〜1、左上原点） */
export type TemplateFieldDef = {
  field_key: string;
  label: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  field_type: FieldType;
  required?: boolean;
  /** 補正ルール名（postprocess で参照） */
  postprocess?: string;
  /** 信頼度ルール（low の閾値など） */
  confidence_rule?: "strict" | "normal" | "lenient";
};

/** 帳票テンプレート */
export type OcrTemplate = {
  id: string;
  name: string;
  formType: string;
  fields: TemplateFieldDef[];
};

/** ページ単位のテンプレート判定結果 */
export type TemplateId = "template_with_requester" | "template_without_requester" | "unknown_template";

/** 1ページ分の1項目の候補（全ページ読んだあとマージする） */
export type FieldCandidate = {
  pageIndex: number;
  template: TemplateId;
  key: string;
  rawText: string;
  normalizedText: string;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  needsReview: boolean;
};
