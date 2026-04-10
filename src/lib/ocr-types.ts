/**
 * OCR 結果のメタデータ用型（クライアント・サーバー共通）
 * Mock 時の信頼度・バウンディングボックス表示に使用
 */

/** 1項目あたりのメタデータ */
export type OcrFieldMeta = {
  value: string;
  confidence: number;
  bbox: { page: number; x: number; y: number; w: number; h: number };
};

/** 項目キー → メタデータのマッピング */
export type OcrFieldMapping = Record<string, OcrFieldMeta>;
