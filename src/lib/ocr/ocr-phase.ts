/**
 * 受付新規登録時のOCR優先順位（目的: 受付登録の自動転記を高速に）
 * - 1次: 受付に必要な固定欄だけ先に読んで画面へ即反映（高速）
 * - 2次: 長文・社内メモ等は後段で読む（問合内容・社内連絡・備考）
 * 全文OCRは行わず、座標切り出しで必要欄のみ読む。
 *
 * 【1次で読む項目】reception_no, requester_name, requester_phone, requester_fax,
 * customer_name, customer_phone, postal_code, customer_address, reception_date,
 * preferred_date, preferred_time, model, model_code, serial_number, ほかガス種・フリガナ
 *
 * 【2次で読む項目】inquiry（問合/依頼内容）, internal_note（社内連絡）, note（備考）
 * （AI要約・症状分類・原因候補・候補部品はOCRではなく後段AIで付与）
 */

/** 1次処理で先に読む項目（受付登録で必須の固定欄） */
export const FIRST_PASS_FIELD_KEYS: readonly string[] = [
  "receptionNo",       // reception_no（修理受付番号）
  "requestStoreName",  // requester_name（依頼元名）
  "requestPhone",      // requester_phone（依頼元電話）
  "requestFax",        // requester_fax（依頼元FAX）
  "customerName",      // customer_name（お客様名）
  "phone",             // customer_phone（お客様電話・自宅）
  "mobile",            // 携帯番号
  "postalCode",        // postal_code（郵便番号）
  "address",           // customer_address（住所）
  "receptionDate",     // reception_date（受付日）
  "desiredVisitDate",  // preferred_date（希望日）
  "desiredVisitTime",  // preferred_time（希望時間）
  "modelName",         // model（型式）
  "reportedModelName", // お申し出型式
  "modelCode",         // model_code（型式コード）
  "nameplateNo",       // serial_number（製番・銘板番号）
  "gasType",           // ガス種（受付で使うため1次に含める）
  "customerFurigana",  // フリガナ（受付表示用）
] as const;

/** 2次処理で後から読む項目（長文・社内メモ・AI連携向け） */
export const SECOND_PASS_FIELD_KEYS: readonly string[] = [
  "inquiryContent",   // inquiry（問合／依頼内容）
  "internalContact",  // internal_note（社内連絡）
  "memo",             // note（備考長文）
  // AI要約・症状分類・原因候補・候補部品はOCR項目ではなく後段AI/Difyで付与
] as const;

/**
 * 座標抽出（extract-fields）の高速モードで先に読む項目のみ
 * 受付新規登録で必要な主要項目だけ。重い自由文（inquiryContent）は後回し。
 * タイムアウト(8〜12s)内に収めるため項目数を絞る。
 */
export const EXTRACT_FIELDS_FAST_KEYS: readonly string[] = [
  "receptionNo",
  "requestStoreName",
  "requestPhone",
  "requestFax",
  "customerName",
  "phone",
  "postalCode",
  "address",
  "receptionDate",
  "desiredVisitDate",
  "desiredVisitTime",
  "modelName",
  "modelCode",
  "nameplateNo",
] as const;

export type OcrPhase = "1" | "2";

export function getFieldKeysForPhase(phase: OcrPhase): readonly string[] {
  return phase === "1" ? FIRST_PASS_FIELD_KEYS : SECOND_PASS_FIELD_KEYS;
}

export function isFirstPassKey(key: string): boolean {
  return (FIRST_PASS_FIELD_KEYS as readonly string[]).includes(key);
}

export function isSecondPassKey(key: string): boolean {
  return (SECOND_PASS_FIELD_KEYS as readonly string[]).includes(key);
}
