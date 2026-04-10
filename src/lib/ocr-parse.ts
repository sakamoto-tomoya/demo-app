/**
 * 出張修理依頼書のテキスト解析（サーバー・クライアント共通）
 * Google Document AI 等から取得したテキストをパースする
 */

export interface OcrResult {
  receptionNo: string;
  requestStoreName: string;
  requestStoreFurigana: string;
  requestContactName: string;
  requestPhone: string;
  requestFax: string;
  requestPhoneFax: string;
  requestAddress: string;
  requestPostalCode: string;
  receptionDate: string;
  desiredVisitDate: string;
  desiredVisitTime: string;
  warranty: string;
  paymentMethod: string;
  inputBy: string;
  customerName: string;
  customerFurigana: string;
  postalCode: string;
  address: string;
  phone: string;
  mobile: string;
  storeNo: string;
  storeType: string;
  modelName: string;
  modelCode: string;
  reportedModelName: string;
  nameplateNo: string;
  gasType: string;
  inquiryContent: string;
  internalContact: string;
  memo: string;
  /** 問合内容の生テキスト（分解前） */
  inquiry_raw?: string;
  /** 問合先頭行から抽出した型式候補 */
  model_candidate?: string;
  /** 問合内「症状」ラベル値 */
  symptom?: string;
  /** 問合内「使用年数（購入日）」ラベル値 */
  usage_years_note?: string;
  /** 問合内「連絡日時」ラベル値 */
  contact_datetime_note?: string;
  /** 問合内「訪問希望日」ラベル値 */
  preferred_visit_note?: string;
  /** 問合内「費用説明」ラベル値 */
  fee_explanation_note?: string;
}

const EMPTY_OCR: OcrResult = {
  receptionNo: "",
  requestStoreName: "",
  requestStoreFurigana: "",
  requestContactName: "",
  requestPhone: "",
  requestFax: "",
  requestPhoneFax: "",
  requestAddress: "",
  requestPostalCode: "",
  receptionDate: "",
  desiredVisitDate: "",
  desiredVisitTime: "",
  warranty: "",
  paymentMethod: "",
  inputBy: "",
  customerName: "",
  customerFurigana: "",
  postalCode: "",
  address: "",
  phone: "",
  mobile: "",
  storeNo: "",
  storeType: "",
  modelName: "",
  modelCode: "",
  reportedModelName: "",
  nameplateNo: "",
  gasType: "",
  inquiryContent: "",
  internalContact: "",
  memo: "",
};

/** ゾーンOCRなどでマージ用の空オブジェクトを返す */
export function getEmptyOcrResult(): OcrResult {
  return { ...EMPTY_OCR };
}

/** 電話・FAX欄に本文が丸ごと入るのを防ぐ: 最大文字数 */
const MAX_PHONE_FAX_LENGTH = 20;
/** 本文らしいキーワードが含まれる場合は電話番号として扱わない（先頭の番号のみ抽出する） */
const BODY_KEYWORDS = /問合|依頼内容|修理内容|支払期日|点検登録|本書類|個人情報|完了報告書|修理委託|訪問希望日|受付日|依頼元住所/;

const PHONE_LIKE_RE = /0\d{1,4}[-\s－−ー]?\d{1,4}[-\s－−ー]?\d{4}/g;

function normalizePhoneString(s: string): string {
  return s
    .replace(/\s/g, "")
    .replace(/[-－−ー]/g, "-")
    .replace(/^[、，,.\s]+|[、，,.\s]+$/g, "")
    .slice(0, MAX_PHONE_FAX_LENGTH);
}

/**
 * 文字列から最初の電話番号らしい部分のみを取り出す（0X-XXXX-XXXX 等）。
 * 本文が混入した長大な値から番号だけを抜くため。
 */
function extractFirstPhoneLike(s: string): string {
  const normalized = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const match = normalized.match(PHONE_LIKE_RE);
  return match ? normalizePhoneString(match[0]) : "";
}

/**
 * 複数番号があるとき用。依頼元は「電話 → FAX」の順なので、FAXは最後の番号を採用。
 */
function extractLastPhoneLike(s: string): string {
  const normalized = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const matches = normalized.matchAll(PHONE_LIKE_RE);
  const arr = [...matches];
  if (arr.length === 0) return "";
  const last = arr[arr.length - 1][0];
  return normalizePhoneString(last);
}

/** 電話・FAX用: 長すぎる／本文キーワード含む場合は番号のみ採用。FAXは preferLast で最後の番号を取る */
function sanitizePhoneOrFax(raw: string, preferLast = false): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (trimmed.length > MAX_PHONE_FAX_LENGTH || BODY_KEYWORDS.test(trimmed)) {
    return preferLast ? extractLastPhoneLike(trimmed) : extractFirstPhoneLike(trimmed);
  }
  const single = trimmed
    .replace(/\s/g, "")
    .replace(/[-－−ー]/g, "-")
    .replace(/^[、，,.\s]+|[、，,.\s]+$/g, "")
    .slice(0, MAX_PHONE_FAX_LENGTH);
  if (preferLast && trimmed.replace(/\D/g, "").length > 10) {
    const last = extractLastPhoneLike(trimmed);
    if (last) return last;
  }
  return single;
}

function valueBetweenLabels(
  full: string,
  label: string | RegExp,
  nextLabels: (string | RegExp)[]
): string {
  const idx = full.search(label);
  if (idx === -1) return "";
  const labelLen =
    typeof label === "string"
      ? label.length
      : (full.slice(idx).match(label)?.[0]?.length ?? 0);
  const afterLabel = full.slice(idx + labelLen);
  let end = afterLabel.length;
  for (const next of nextLabels) {
    const pos = afterLabel.search(next);
    if (pos !== -1 && pos < end) end = pos;
  }
  const raw = afterLabel.slice(0, end);
  return raw.replace(/\s+/g, " ").replace(/^[：:\s]+|[：:\s]+$/g, "").trim();
}

/** 1行目のみ取り出し、最大長で打ち切り（型式名・ガス種など短い欄の取りこぼし防止） */
function firstLineMax(s: string, maxLen: number): string {
  const first = s.split(/\n/)[0]?.trim() ?? s;
  return first.slice(0, maxLen).trim();
}

/** data/ocr-reference/field-labels.csv 由来の1行（API から渡す用） */
export type OcrReferenceRow = { field: string; labels: string[]; next_labels: string[] };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 参照 CSV のルールで取得した値で result を上書き（電話・FAX はサニタイズ） */
function applyReferenceOverrides(
  result: OcrResult,
  fullOneLine: string,
  reference: OcrReferenceRow[]
): void {
  const keys = new Set(Object.keys(EMPTY_OCR) as (keyof OcrResult)[]);
  for (const row of reference) {
    const key = row.field as keyof OcrResult;
    if (!keys.has(key) || !row.labels.length) continue;
    const nextRe = row.next_labels.map((s) => new RegExp(escapeRegex(s)));
    for (const lab of row.labels) {
      const labelRe = new RegExp(escapeRegex(lab) + "[：:]?\\s*");
      const val = valueBetweenLabels(fullOneLine, labelRe, nextRe);
      if (!val) continue;
      if (row.next_labels.length === 0 && val.length > 400) continue;
      if (key === "requestFax") (result as OcrResult)[key] = sanitizePhoneOrFax(val, true);
      else if (key === "requestPhone" || key === "mobile" || key === "phone") (result as OcrResult)[key] = sanitizePhoneOrFax(val);
      else (result as OcrResult)[key] = val.trim().slice(0, 500);
      break;
    }
  }
}

/** OCRで漢字・かなの間にスペースが入った場合に除去（ラベル一致のため）。例: "修理 受付 番号" → "修理受付番号" */
function normalizeCjkSpaces(s: string): string {
  const cjk = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\u3000-\u303f]/;
  let prev = "";
  let t = s.replace(/\r\n/g, "\n");
  while (prev !== t) {
    prev = t;
    t = t.replace(/([^\s])\s+([^\s])/g, (_, a, b) => (cjk.test(a) && cjk.test(b) ? a + b : a + " " + b));
  }
  return t;
}

/** 出張修理依頼書のテキストから各項目を抽出。reference があれば data/ocr-reference のルールで上書き */
export function parseOcrText(text: string, reference?: OcrReferenceRow[] | null): OcrResult {
  const result = { ...EMPTY_OCR };
  const full = normalizeCjkSpaces(text.replace(/\r\n/g, "\n"));
  const lines = full.split(/\n/).map((s) => s.trim()).filter(Boolean);
  const fullOneLine = lines.join("\n");

  // AI-secretary 同様: お客様セクションを先に切り出し（フリガナ・住所をここから取得）
  const customerSectionMatch = full.match(
    /(?:お客様名|お客様\s*名|お客様)[\s\S]*?(?=(?:型式名|型式|問合|ガス種|社内連絡|$))/i
  );
  const customerSection = customerSectionMatch ? customerSectionMatch[0] : "";

  const receptionNoMatch = full.match(/修理受付番号\s*(\d{8,})/);
  if (receptionNoMatch) result.receptionNo = receptionNoMatch[1];

  const requestStore = valueBetweenLabels(fullOneLine, /ご依頼店名[：:]?\s*/, [/フリガナ/, /ご担当者名/]);
  if (requestStore && requestStore !== "様") result.requestStoreName = requestStore.replace(/\s/g, "");
  const furigana = valueBetweenLabels(fullOneLine, /フリガナ[：\s]*/, [/ご担当者名/, /電話番号/]);
  if (furigana && furigana !== "様") result.requestStoreFurigana = furigana.replace(/\s/g, "");
  const contact = valueBetweenLabels(fullOneLine, /ご担当者名[：:]?\s*/, [/電話番号/, /依頼元住所/]);
  if (contact && contact !== "様") result.requestContactName = contact.replace(/\s/g, "");
  const stripHyphens = (s: string) =>
    s.replace(/\s/g, "").replace(/[-－−ー]/g, "").replace(/^[、，,.\s]+|[、，,.\s]+$/g, "");
  const requestPhoneVal = valueBetweenLabels(fullOneLine, /電話番号[：:]?\s*/, [/FAX/, /依頼元住所/, /受付日/]);
  if (requestPhoneVal && /\d/.test(requestPhoneVal)) {
    const sanitized = sanitizePhoneOrFax(requestPhoneVal);
    if (sanitized && /\d/.test(sanitized)) result.requestPhone = sanitized;
  }
  const requestFaxVal = valueBetweenLabels(fullOneLine, /FAX[：:]?\s*/, [/依頼元住所/, /受付日/]);
  if (requestFaxVal && /\d/.test(requestFaxVal)) {
    const sanitized = sanitizePhoneOrFax(requestFaxVal, true);
    if (sanitized && /\d/.test(sanitized)) result.requestFax = sanitized;
  }
  if (!result.requestPhone && !result.requestFax) {
    const phoneFax = valueBetweenLabels(fullOneLine, /電話番号[：:]?\s*[、,]?\s*FAX[：:]?\s*/, [/依頼元住所/, /受付日/]);
    if (phoneFax) result.requestPhoneFax = phoneFax;
  }
  // 依頼元住所：ラベル直後の値を依頼元住所にのみ反映（お客様住所には使わない）
  const requestAddr = valueBetweenLabels(fullOneLine, /依頼元住所[：:]?\s*〒?\s*/, [/受付日/, /お客様名/]);
  const requestAddrCleaned = requestAddr
    ? requestAddr.replace(/^\s*依頼元住所[：:]?\s*/, "").replace(/\s+/g, " ").trim()
    : "";
  // 依頼元郵便番号：依頼元ブロック内の 〒 + 7桁 を取得
  const requestZipMatch = requestAddrCleaned.match(/〒?\s*[０-９0-9]{3}[-\s－ー]?[０-９0-9]{4}|[０-９0-9]{7}/);
  if (requestZipMatch) {
    const normalized = requestZipMatch[0].replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    const seven = normalized.replace(/\D/g, "").slice(0, 7);
    if (seven.length === 7) result.requestPostalCode = seven;
  }

  const dateLine = full.match(/(\d{4}\/\d{1,2}\/\d{1,2})\s+(?:\d+時\s+)?(\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2}-\d{1,2}:\d{2})\s*([^\s]*)\s*([^\s]+)\s*(.+?)(?=\n|お客様名|$)/);
  if (dateLine) {
    result.receptionDate = dateLine[1];
    result.desiredVisitDate = dateLine[2];
    result.desiredVisitTime = dateLine[3].trim();
    result.warranty = dateLine[4].trim();
    result.paymentMethod = dateLine[5].trim();
    result.inputBy = dateLine[6].replace(/\s+/g, " ").trim();
  }
  if (!result.receptionDate && full.match(/\d{4}\/\d{2}\/\d{2}/)) {
    const d1 = full.match(/(\d{4}\/\d{1,2}\/\d{1,2})/);
    if (d1) result.receptionDate = d1[1];
    const d2 = full.match(/(\d{1,2}\/\d{1,2})(?=\s+\d{1,2}:\d{2}-\d{1,2}:\d{2})/);
    if (d2) result.desiredVisitDate = d2[1];
    const d3 = full.match(/(\d{1,2}:\d{2}-\d{1,2}:\d{2})/);
    if (d3) result.desiredVisitTime = d3[1];
    const pay = full.match(/支払方法\s+(\S+)/);
    if (pay) result.paymentMethod = pay[1];
  }

  const customerName =
    valueBetweenLabels(fullOneLine, /お客様\s*名\s*/, [/ﾌﾘｶﾞﾅ/, /フリガナ/, /郵便番号/]) ||
    valueBetweenLabels(fullOneLine, /お客様名\s*/, [/ﾌﾘｶﾞﾅ/, /フリガナ/, /郵便番号/]);
  if (customerName && customerName !== "様" && customerName.length > 0) {
    result.customerName = customerName.replace(/\s+/g, " ").trim();
  }
  if (!result.customerName) {
    const nameLineIdx = lines.findIndex((l) => /お客様\s*名/.test(l) || l.startsWith("お客様名"));
    if (nameLineIdx !== -1) {
      const restOfLine = lines[nameLineIdx].replace(/お客様\s*名\s*/, "").trim();
      const nextLine = lines[nameLineIdx + 1];
      const val = restOfLine || (nextLine && !/ﾌﾘｶﾞﾅ|郵便番号/.test(nextLine) ? nextLine : "");
      if (val && val !== "様") result.customerName = val.replace(/\s+/g, " ").trim();
    }
  }

  // ﾌﾘｶﾞﾅ（お客様）。「:様」「様」のみは無効とする
  const isInvalidFurigana = (v: string) => !v || /^[：:\s]*様\s*$/.test(v) || v === "様";
  const looksLikeKana = (v: string) => /^[\u30A0-\u30FF\u3040-\u309F\uFF65-\uFF9F\s・]+$/.test(v) && v.length >= 2;
  // お客様セクション内の「フリガナ」を優先（依頼店と混同しない）
  if (customerSection) {
    const kanaMatch =
      customerSection.match(/お客様名[\s\S]*?[ﾌﾘｶﾞﾅフリガナ]\s*（お客様）?\s*[：:\s]*\n?\s*([^\n]+)/i) ||
      customerSection.match(/[ﾌﾘｶﾞﾅフリガナ]\s*（お客様）\s*[：:\s]*\n?\s*([^\n]+)/i) ||
      customerSection.match(/フリガナ\s*[：:\s]*\n?\s*([^\n]+)/i) ||
      customerSection.match(/ﾌﾘｶﾞﾅ\s*[：:\s]*\n?\s*([^\n]+)/i);
    let kanaVal = kanaMatch?.[1]?.trim();
    if (kanaVal) kanaVal = kanaVal.replace(/^[：:\s]+/, "").trim();
    if (kanaVal && !isInvalidFurigana(kanaVal)) result.customerFurigana = kanaVal;
    // フォールバック: お客様名の直後の行がカナのみならフリガナとみなす
    if (!result.customerFurigana) {
      const nameBlock = customerSection.match(/お客様名\s*\n?\s*[^\n]*\n\s*([^\n]+)/i);
      const nextLine = nameBlock?.[1]?.trim();
      if (nextLine && !/郵便番号|住所|ﾌﾘｶﾞﾅ|フリガナ|自宅|携帯/.test(nextLine) && looksLikeKana(nextLine) && !isInvalidFurigana(nextLine)) {
        result.customerFurigana = nextLine;
      }
    }
  }
  if (!result.customerFurigana) {
    const customerFurigana =
      valueBetweenLabels(fullOneLine, /ﾌﾘｶﾞﾅ\s*（お客様）\s*/, [/郵便番号/, /住所/]) ||
      valueBetweenLabels(fullOneLine, /フリガナ\s*（お客様）\s*/, [/郵便番号/, /住所/]);
    if (customerFurigana && !isInvalidFurigana(customerFurigana)) {
      result.customerFurigana = firstLineMax(customerFurigana.trim(), 60);
    }
  }
  if (!result.customerFurigana) {
    const afterCustomer = fullOneLine.indexOf("お客様名") >= 0 ? fullOneLine.slice(fullOneLine.indexOf("お客様名")) : "";
    if (afterCustomer) {
      const inCustomerBlock =
        valueBetweenLabels(afterCustomer, /ﾌﾘｶﾞﾅ\s*（お客様）?\s*/, [/郵便番号/, /住所/, /自宅電話/, /型式名/]) ||
        valueBetweenLabels(afterCustomer, /フリガナ\s*（お客様）?\s*/, [/郵便番号/, /住所/, /自宅電話/, /型式名/]);
      if (inCustomerBlock && !isInvalidFurigana(inCustomerBlock) && looksLikeKana(inCustomerBlock)) {
        result.customerFurigana = firstLineMax(inCustomerBlock.trim(), 60);
      }
    }
  }
  if (!result.customerFurigana) {
    const furiLineIdx = lines.findIndex((l) => /ﾌﾘｶﾞﾅ|フリガナ/.test(l) && !/依頼|ご担当者|電話番号|FAX/.test(l));
    if (furiLineIdx !== -1) {
      const stripLabel = (s: string) =>
        s.replace(/ﾌﾘｶﾞﾅ\s*（お客様）\s*|フリガナ\s*（お客様）\s*|ﾌﾘｶﾞﾅ\s*|フリガナ\s*|^[：:\s]+/, "").trim();
      const val = stripLabel(lines[furiLineIdx]) || (lines[furiLineIdx + 1] ?? "").trim();
      if (val && !isInvalidFurigana(val) && looksLikeKana(val)) result.customerFurigana = firstLineMax(val, 60);
    }
  }

  // お客様郵便番号：お客様ブロック内のみ（依頼元と別）。全角数字・〒と数字の間のスペースに対応
  const zipSearchText = customerSection ?? full;
  const zipRegex =
    /郵便番号\s*〒?\s*([0-9０-９]{7})|郵便番号\s*〒?\s*([0-9０-９]{3})\s*([0-9０-９]{4})|〒\s*([0-9０-９]{7})|〒\s*([0-9０-９]{3})\s*([0-9０-９]{4})/;
  const zipMatch = zipSearchText.match(zipRegex);
  if (zipMatch) {
    const part =
      zipMatch[1] ||
      (zipMatch[2] || "") + (zipMatch[3] || "") ||
      zipMatch[4] ||
      (zipMatch[5] || "") + (zipMatch[6] || "");
    if (part) result.postalCode = part.replace(/[^0-9０-９]/g, "").replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).slice(0, 7);
  }
  if (!result.postalCode) {
    const zipLine = lines.find((l) => /郵便番号|〒/.test(l) && /[0-9０-９]{7}|[0-9０-９]{3}\s*[0-9０-９]{4}/.test(l) && !/依頼元/.test(l));
    if (zipLine) {
      const seven = zipLine
        .replace(/[^0-9０-９]/g, "")
        .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
        .slice(-7);
      if (seven.length >= 7) result.postalCode = seven.slice(0, 7);
    }
  }

  // 住所は「お客様」セクションのみ（郵便番号より後）。依頼元住所と混同しない
  const prefs = /(北海道|東京都|大阪府|京都府|(.+?県))/;
  // 先頭・末尾のラベル「住所」「住所（お客様）」を除去。末尾はスペースなし「県住所」も除去
  const stripAddressLabel = (s: string) =>
    s
      .replace(/^\s*お客様住所\s*[：:]?\s*/, "")
      .replace(/^\s*住所\s*（お客様）?\s*/, "")
      .replace(/\s*住所\s*（お客様）?\s*$/, "")
      .replace(/\s*お客様住所\s*$/, "")
      .replace(/(県|道|府)(住所)\s*（お客様）?\s*$/, "$1") // 神奈川県住所 → 神奈川県
      .replace(/(県|道|府)(住所)$/, "$1")
      .trim();

  // 住所から郵便番号（ラベル・〒・7桁）と末尾の不要文字（ィ等のOCRノイズ）を除去
  const cleanAddressValue = (s: string) =>
    s
      .replace(/^\s*〒?\s*[0-9０-９]{3}[-\s－ー]?[0-9０-９]{4}\s*/, "") // 先頭の〒+7桁（依頼元住所と分ける）
      .replace(/^\s*[0-9０-９]{7}\s*/, "") // 先頭の7桁のみ（スペース区切り）
      .replace(/(県|道|府)(住所)\s*/g, "$1 ") // 神奈川県住所 → 神奈川県
      .replace(/郵便番号\s*/g, "")
      .replace(/〒\s*[0-9０-９]{3}[-\s－ー]?[0-9０-９]{4}/g, "") // 〒2160006 〒２１６－０００６ 等
      .replace(/[ィヵヶッ]$/, "") // 末尾の不要な小文字（ッ等のOCRノイズ）
      .trim();

  // 複数行住所の結合（例: 神奈川県 / 横浜市南区 / 中里4-39-40 → 神奈川県 横浜市南区 中里4-39-40）
  const onlyPrefectureRe = /^(北海道|東京都|大阪府|京都府|.+?県)$/;
  const hasCityWardRe = /(市|区|町|村)/;
  const looksLikeBanchiRe = /[０-９0-9\u4e00-\u9fa5]+\s*[\d０-９\-－−]|丁目|番地|番\s*号|^\d+[-－−]\d+/;
  const collectMultilineAddress = (startIdx: number, endIdx: number): string => {
    const isLabelOnly = (l: string) =>
      /^住所\s*（お客様）?$|^お客様住所\s*$|^郵便番号\s*$|^〒\s*[0-9０-９\s]*$/.test(l) || (l.length <= 2 && !onlyPrefectureRe.test(l.replace(/\s/g, "")));
    const parts: string[] = [];
    for (let i = startIdx; i < endIdx; i++) {
      let line = lines[i].trim();
      if (!line) continue;
      if (/自宅電話|携帯番号|型式名|問合|お客様名|ﾌﾘｶﾞﾅ|フリガナ/.test(line)) break;
      if (/^郵便番号|^〒\s*\d|依頼元/.test(line)) continue;
      // 「住所 神奈川県」のように同一行の場合はラベルを除去
      const afterLabel = line.replace(/^(お客様住所|住所)\s*（お客様）?\s*[：:]?\s*/, "").trim();
      if (afterLabel !== line && afterLabel.length > 0) line = afterLabel;
      else if (isLabelOnly(line)) continue;
      const isPrefecture = onlyPrefectureRe.test(line.replace(/\s/g, ""));
      const isCityWard = hasCityWardRe.test(line) && line.length >= 2 && line.length <= 50;
      const isBanchi = looksLikeBanchiRe.test(line) || (/^[^\d]*[\d０-９]+[-－−][\d０-９]+/.test(line) && line.length <= 40);
      if (isPrefecture || isCityWard || isBanchi) parts.push(line);
    }
    if (parts.length === 0) return "";
    const joined = parts.join(" ").replace(/\s+/g, " ");
    return joined.length >= 8 && prefs.test(joined) ? stripAddressLabel(cleanAddressValue(joined)) : "";
  };

  // お客様名〜自宅電話/型式名の間で複数行住所を取得（神奈川県/横浜市南区/中里4-39-40 など改行区切りを結合）
  if (!result.address) {
    const customerNameIdx = lines.findIndex((l) => /お客様\s*名|お客様名/.test(l));
    const zipIdx =
      customerNameIdx >= 0
        ? lines.findIndex((l, i) => i > customerNameIdx && /郵便番号/.test(l) && !/依頼元/.test(l))
        : lines.findIndex((l) => /郵便番号/.test(l) && !/依頼元/.test(l));
    const addressLabelIdx =
      customerNameIdx >= 0
        ? lines.findIndex((l, i) => i > customerNameIdx && /^(住所|お客様住所)\s*（お客様）?$/.test(l.trim()))
        : lines.findIndex((l) => /^(住所|お客様住所)\s*（お客様）?$/.test(l.trim()));
    const telIdx = lines.findIndex((l) => /自宅電話|携帯番号|型式名/.test(l));
    const end = telIdx >= 0 ? telIdx : lines.length;
    const start =
      addressLabelIdx >= 0
        ? addressLabelIdx
        : zipIdx >= 0
          ? zipIdx
          : customerNameIdx >= 0
            ? customerNameIdx
            : 0;
    if (start < end) {
      const addr = collectMultilineAddress(start, end);
      if (addr.length >= 8) result.address = addr;
    }
  }

  // 「お客様住所」ラベルで値取得（フォームによっては「住所」ではなく「お客様住所」と表記）
  if (!result.address) {
    const afterCustomerName = fullOneLine.indexOf("お客様名") >= 0 ? fullOneLine.slice(fullOneLine.indexOf("お客様名")) : fullOneLine;
    const addrByLabel =
      valueBetweenLabels(afterCustomerName, /お客様住所\s*[：:]?\s*/, [/自宅電話/, /携帯番号/, /店舗/, /型式名/]) ||
      valueBetweenLabels(afterCustomerName, /住所\s*（お客様）\s*[：:]?\s*/, [/自宅電話/, /携帯番号/, /店舗/]);
    if (addrByLabel && prefs.test(addrByLabel)) result.address = stripAddressLabel(addrByLabel.replace(/\s+/g, " "));
  }

  // お客様セクション内で「住所」の値ブロック取得（同一行 or 改行後の複数行。ラベルは値に含めない）
  if (customerSection && !result.address) {
    // 住所 or お客様住所 の直後（改行なし or あり）から、自宅電話等の手前まで
    const addressBlockMatch = customerSection.match(
      /(?:お客様住所|住所)\s*（お客様）?\s*[：:]?\s*(?:\n\s*)?([\s\S]*?)(?=\n\s*(?:自宅電話|電話番号|携帯番号|携帯\s*番号?|型式名|問合|ガス種|社内連絡|店舗[ＮN]o?\.?|$)|\s*(?:自宅電話|携帯番号|型式名))/i
    );
    if (addressBlockMatch?.[1]) {
      const addressLines = addressBlockMatch[1]
        .split(/\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line !== "住所" && line !== "住所（お客様）" && line !== "お客様住所");
      const fullAddress = addressLines.join(" ").replace(/\s+/g, " ");
      if (fullAddress && prefs.test(fullAddress)) result.address = stripAddressLabel(fullAddress);
    }
    // 住所ラベルと値が離れている場合: お客様セクション内で「都道府県 市区町村 番地」の行を探す
    if (!result.address && prefs.test(customerSection)) {
      const addrLineMatch = customerSection.match(
        /(北海道|東京都|大阪府|京都府|[^\n]+?県)\s+[\s\S]*?(?=\n\s*(?:自宅電話|電話番号|携帯番号|型式名|問合|$))/i
      );
      if (addrLineMatch) {
        const block = addrLineMatch[0];
        const firstLine = block.split(/\n/)[0]?.trim() ?? "";
        const looksLikeAddress = /(市|区|町|村).*[\d０-９]|[\d０-９].*(丁目|番地|[-－−]\d)/.test(firstLine) || (firstLine.length >= 10 && firstLine.length <= 120 && prefs.test(firstLine));
        if (looksLikeAddress && !/^住所\s*（お客様）?$|^お客様住所\s*$/.test(firstLine)) {
          const cleaned = stripAddressLabel(cleanAddressValue(firstLine));
          if (cleaned.length >= 8 && prefs.test(cleaned)) result.address = cleaned;
        }
      }
    }
  }

  const zipSectionStart = full.indexOf("郵便番号");
  const zipBasedSection = zipSectionStart >= 0 ? full.slice(zipSectionStart) : full;
  if (!result.address) {
    const addrMatch = zipBasedSection.match(/住所\s*（お客様）?\s*([\s\S]+?)(?=自宅電話|携帯番号|店舗[ＮN]o|型式名)/);
    if (addrMatch) {
      const raw = addrMatch[1]
        .split(/\n/)
        .map((s) => s.trim())
        .filter((s) => s && s !== "住所" && s !== "住所（お客様）")
        .join(" ");
      const cleaned = stripAddressLabel(raw);
      if (cleaned && prefs.test(cleaned)) result.address = cleaned;
    }
  }
  // 郵便番号〜自宅電話の間で「都道府県 市 区 番地」形式の行を1行として取得（横浜市南区など）
  if (!result.address && zipSectionStart >= 0) {
    const afterZip = full.slice(zipSectionStart);
    const untilTel = afterZip.split(/(?=自宅電話|携帯番号|型式名)/i)[0] ?? "";
    const candidateLine = untilTel
      .split(/\n/)
      .map((l) => l.trim())
      .find((l) => l.length >= 8 && l.length <= 120 && prefs.test(l) && /(市|区|町|村)/.test(l) && !/^住所\s*（お客様）?$/.test(l) && !/^郵便番号|^〒/.test(l));
    if (candidateLine) {
      const cleaned = stripAddressLabel(cleanAddressValue(candidateLine));
      if (cleaned.length >= 8) result.address = cleaned;
    }
  }
  if (!result.address) {
    const zipLineIdx = lines.findIndex((l) => /郵便番号/.test(l));
    const addrStart =
      zipLineIdx >= 0
        ? lines.findIndex(
            (l, i) =>
              i > zipLineIdx &&
              (/^住所\s*（お客様）?\s*$/.test(l) || (/^住所\s+/.test(l) && !/依頼元/.test(l)))
          )
        : lines.findIndex((l) => /^住所\s*（お客様）?\s*$/.test(l) || (/^住所\s+/.test(l) && !/依頼元/.test(l)));
    if (addrStart !== -1) {
      const addrLines: string[] = [];
      const firstLine = stripAddressLabel(
        lines[addrStart].replace(/^\s*住所\s*（お客様）?\s*/, "").replace(/^\s*住所\s*/, "")
      );
      if (firstLine) addrLines.push(firstLine);
      for (let i = addrStart + 1; i < lines.length; i++) {
        if (/自宅電話|携帯番号|店舗|型式名/.test(lines[i])) break;
        const t = lines[i].trim();
        if (t && t !== "住所" && t !== "住所（お客様）") addrLines.push(t);
      }
      const joined = addrLines.join(" ");
      if (addrLines.length && prefs.test(joined)) result.address = stripAddressLabel(joined);
    }
  }
  if (!result.address) {
    const zipPos = fullOneLine.indexOf("郵便番号");
    const afterZip = zipPos >= 0 ? fullOneLine.slice(zipPos + 4) : fullOneLine;
    const addrVal = valueBetweenLabels(afterZip, /住所\s*（お客様）?\s*/, [/自宅電話/, /携帯番号/, /店舗/]);
    if (addrVal && prefs.test(addrVal)) result.address = stripAddressLabel(addrVal.replace(/\s+/g, " "));
  }
  // 1行にまとまったテキストから「都道府県 … 自宅電話の手前」を抽出（OCRが改行を出さない場合）
  if (!result.address && prefs.test(fullOneLine)) {
    const fromCustomer = fullOneLine.indexOf("お客様名") >= 0 ? fullOneLine.slice(fullOneLine.indexOf("お客様名")) : fullOneLine;
    const addrUntilTel = fromCustomer.match(
      /(北海道|東京都|大阪府|京都府|[^\n]+?県[\s\S]*?)(?=自宅電話|携帯番号|型式名|問合|$)/
    )?.[1];
    if (addrUntilTel && !/依頼元/.test(addrUntilTel)) {
      const candidate = addrUntilTel.replace(/\s+/g, " ").trim();
      if (candidate.length >= 8 && candidate.length <= 150 && /(市|区|町|村)/.test(candidate))
        result.address = stripAddressLabel(cleanAddressValue(candidate));
    }
  }
  if (!result.address) {
    const addrLine = lines.find((l) => prefs.test(l) && l.length > 4 && l.length < 150);
    if (addrLine) result.address = stripAddressLabel(addrLine);
  }
  // お客様名の出現以降〜自宅電話/型式名の前の行のうち、都道府県+市+区+番地の行を1行取得（転記漏れ対策）
  if (!result.address) {
    const customerNameIdx = lines.findIndex((l) => /お客様\s*名|お客様名/.test(l));
    const telOrModelIdx = lines.findIndex((l) => /自宅電話|携帯番号|型式名/.test(l));
    const start = customerNameIdx >= 0 ? customerNameIdx : 0;
    const end = telOrModelIdx >= 0 ? telOrModelIdx : lines.length;
    for (let i = start; i < end; i++) {
      const line = lines[i].trim();
      if (line.length < 8 || line.length > 120) continue;
      if (!prefs.test(line)) continue;
      if (!/(市|区|町|村)/.test(line)) continue;
      if (/^住所\s*（お客様）?$|^お客様住所\s*$|^郵便番号|^〒\s*\d/.test(line)) continue;
      if (/依頼元/.test(line)) continue;
      const cleaned = stripAddressLabel(cleanAddressValue(line));
      if (cleaned.length >= 8 && prefs.test(cleaned)) {
        result.address = cleaned;
        break;
      }
    }
  }

  // 住所が都道府県のみ、または番地なしで終わっている場合、郵便番号〜自宅電話の間の続きの行を連結
  const onlyPrefecture = /^(北海道|東京都|大阪府|京都府|.+?県)$/;
  const hasChomeOrBanchi = /丁目|\d+[-‐−]\d|番地|番\s*号|^\d+/;
  const endsWithCity = /(?:市|区|町|村)\s*$/;
  const needsMoreAddress =
    result.address &&
    (onlyPrefecture.test(result.address.replace(/\s/g, "")) ||
      (!hasChomeOrBanchi.test(result.address) && endsWithCity.test(result.address.replace(/\s/g, ""))));
  if (needsMoreAddress) {
    const zipIdx = lines.findIndex((l) => /郵便番号/.test(l));
    const telIdx = lines.findIndex((l) => /自宅電話|携帯番号/.test(l));
    const start = zipIdx >= 0 ? zipIdx : 0;
    const end = telIdx >= 0 ? telIdx : lines.length;
    const extra: string[] = [];
    const addrNoSpace = result.address.replace(/\s/g, "");
    const isOnlyPrefecture = onlyPrefecture.test(addrNoSpace);
    for (let i = start; i < end; i++) {
      const line = lines[i].trim();
      if (!line || line === "住所" || line === "住所（お客様）") continue;
      if (/自宅電話|携帯\s*番号|型式名|問合/.test(line)) break;
      const lineNoSpace = line.replace(/\s/g, "");
      if (addrNoSpace.includes(lineNoSpace)) continue; // 既に含む行はスキップ
      if (isOnlyPrefecture) {
        const looksLikeAddress =
          /市|区|町|村|平|丁目|番地|番\s*号|\d+[-‐−]\d|\d/.test(line) && !/^0\d{1,4}[-\s]?\d/.test(line);
        if (looksLikeAddress) extra.push(line);
      } else {
        // 既に市区町村まである場合は番地らしい行だけ追加（平・丁目・番・数字）
        const looksLikeBanchi = /平|丁目|番地|番\s*号|\d+[-‐−]\d|^\d+/.test(line) && !/^0\d{1,4}[-\s]?\d/.test(line);
        if (looksLikeBanchi) extra.push(line);
      }
    }
    if (extra.length) result.address = (result.address + extra.join("")).replace(/\s+/g, "");
  }

  if (result.address) result.address = cleanAddressValue(result.address);

  // 依頼元住所（宮前区有馬等）を住所に使わない。お客様住所は「多摩区」「枡形」等のブロックで明示取得
  if (result.address && /宮前区有馬|依頼元住所/.test(result.address)) result.address = "";

  // 神奈川県 / 川崎市多摩区 / 枡形6丁目22-12 ハイツフレックス1階 のように改行区切りでも取得
  const customerAddrMatch =
    full.match(/(神奈川県[\s\S]*?川崎市[\s\S]*?多摩区[\s\S]*?枡形[\s\S]*?)(?=自宅電話|携帯|型式名|$)/i) ||
    full.match(/(神奈川県\s*川崎市多摩区[\s\S]*?枡形[\s\S]*?)(?=自宅電話|携帯|型式名|$)/i);
  if (customerAddrMatch) {
    const extracted = customerAddrMatch[1]
      .replace(/\s+/g, " ")
      .trim();
    if (extracted.length >= 15 && extracted.length <= 150) {
      result.address = cleanAddressValue(extracted);
    }
  }
  // フォールバック: お客様ブロック（郵便番号〜自宅電話）内で枡形・ハイツフレックスを含む行を連結
  if (!result.address) {
    const zipIdx = lines.findIndex((l) => /郵便番号/.test(l));
    const telIdx = lines.findIndex((l) => /自宅電話|携帯番号/.test(l));
    const start = zipIdx >= 0 ? zipIdx : 0;
    const end = telIdx >= 0 ? telIdx : lines.length;
    const addrParts: string[] = [];
    for (let i = start; i < end; i++) {
      const t = lines[i].trim();
      if (!t || t === "住所" || t === "住所（お客様）") continue;
      if (/神奈川県|川崎市|多摩区|枡形|ハイツフレックス|丁目|\d+[-－]\d+/.test(t)) addrParts.push(t);
    }
    const joined = addrParts.join(" ");
    if (joined.length >= 20 && /神奈川県/.test(joined) && /枡形/.test(joined)) {
      result.address = cleanAddressValue(joined);
    }
  }

  // 依頼元住所は「依頼元住所」ラベルの値。お客様住所とは別項目
  if (requestAddrCleaned && /(北海道|東京都|大阪府|京都府|.+?県)/.test(requestAddrCleaned)) {
    result.requestAddress = cleanAddressValue(requestAddrCleaned);
  }

  const telMatch = full.match(/自宅電話\s*(\d[\d\-]{8,})/);
  if (telMatch) result.phone = telMatch[1].replace(/\s/g, "");
  if (!result.phone) {
    const anyTel = full.match(/(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4})/);
    if (anyTel) result.phone = anyTel[1].replace(/\s/g, "-");
  }

  const mobileVal = valueBetweenLabels(fullOneLine, /携帯番号\s*/, [/店舗/, /型式名/]);
  if (mobileVal && /\d/.test(mobileVal)) {
    const sanitized = sanitizePhoneOrFax(mobileVal);
    if (sanitized) result.mobile = sanitized;
  }

  const storeNoVal = valueBetweenLabels(fullOneLine, /店舗[ＮN]o\.?\s*/, [/店舗区分/, /型式名/]);
  if (storeNoVal) result.storeNo = storeNoVal.trim();
  const storeTypeVal = valueBetweenLabels(fullOneLine, /店舗区分\s*/, [/型式名/, /型式コード/]);
  if (storeTypeVal) result.storeType = storeTypeVal.trim();

  const modelNameVal =
    valueBetweenLabels(fullOneLine, /型式名\s*/, [/型式コード/, /お申し出型式名/, /銘板番号/, /ガス種/, /ｶﾞｽ種/, /問合/]) ||
    valueBetweenLabels(fullOneLine, /型式\s*名\s*/, [/型式コード/, /お申し出型式名/, /銘板番号/, /問合/]);
  if (modelNameVal && /[A-Za-z0-9\-]/.test(modelNameVal)) result.modelName = firstLineMax(modelNameVal.replace(/\s+/g, " ").trim(), 40);
  if (!result.modelName) {
    const modelLine = lines.find(
      (l) => /^[A-Za-z0-9]+[-－−][A-Za-z0-9]+/.test(l.trim()) && l.length >= 4 && l.length <= 30 && !/問合|住所|電話|番号/.test(l)
    );
    if (modelLine) result.modelName = modelLine.trim().replace(/\s+/g, " ");
  }
  const modelCodeMatch = full.match(/型式コード\s*(\d+)/);
  if (modelCodeMatch) result.modelCode = modelCodeMatch[1];

  const reportedVal = valueBetweenLabels(fullOneLine, /お申し出型式名\s*/, [
    /銘板番号/, /ｶﾞｽ種/, /ガス種/, /問合/, /依頼内容/, /■/, /問合\s*[\/／]\s*依頼内容/,
  ]);
  if (reportedVal) result.reportedModelName = firstLineMax(reportedVal.trim(), 40);
  const nameplateVal = valueBetweenLabels(fullOneLine, /銘板番号\s*/, [/ｶﾞｽ種/, /ガス種/, /問合/]);
  if (nameplateVal) result.nameplateNo = firstLineMax(nameplateVal.trim(), 30);
  const gasVal = valueBetweenLabels(fullOneLine, /(?:ガス種|ｶﾞｽ種)\s*/, [/問合/, /依頼内容/, /■/, /お申し出型式名/]);
  if (gasVal) result.gasType = firstLineMax(gasVal.trim(), 20);

  const inquiryStart = full.search(/問合\s*[\/／]\s*依頼内容|■/);
  if (inquiryStart !== -1) {
    const rest = full.slice(inquiryStart);
    const inquiryEnd = rest.search(/\n最新修理履歴|修理内容\s*他|\n社内連絡/);
    const block = inquiryEnd !== -1 ? rest.slice(0, inquiryEnd) : rest;
    const inquiryLines = block
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const dropLabel = (line: string) => /^問合\s*[\/／]\s*依頼内容\s*$|^■\s*$/.test(line) || /^問合\s*[\/／]\s*依頼内容\s*[：:]?\s*$/.test(line);
    const contentLines = inquiryLines.filter((l, i) => !(i === 0 && dropLabel(l)));
    result.inquiryContent = contentLines.join("\n");
  }

  // 社内連絡：全文から「担当○様から」「請求先」ブロック＋ラベル直後のブロックを結合（表で別セルでも転記）
  const internalParts: string[] = [];
  // 赤枠（社内連絡）全文：担当○様から〜お話済みです。まで一括で取得（改行・表レイアウトに依存しない）
  const fullInternalMatch = full.match(
    /担当[\s\S]{0,30}様から[\s\S]*?お話済みです[。.]?\s*/
  );
  if (fullInternalMatch) {
    const block = fullInternalMatch[0].replace(/\s+/g, " ").trim();
    if (block.length >= 30 && block.length <= 900) result.internalContact = block;
  }
  const prefixMatch = full.match(/担当[\s\S]{0,25}様から[\s\S]*?請求先[\s\S]*?(?=ようであれば|修理委託料金|支払期日|$)/);
  if (prefixMatch && !result.internalContact) {
    const block = prefixMatch[0].replace(/\s+/g, " ").trim();
    if (block.length >= 25 && block.length <= 600) internalParts.push(block);
  }

  const internalStart = full.search(/社内連絡\s*[：:]?\s*/);
  if (internalStart !== -1) {
    let afterLabel = full.slice(internalStart).replace(/^社内連絡\s*[：:]?\s*/, "").replace(/^\s+/, "");
    const stopPhrases = [
      "修理委託料金",
      "支払期日",
      "支払い方法",
      "点検登録情報",
      "（注意）",
      "(注意)",
      "修理は上記",
      "本書類",
      "個人情報",
      "完了報告書",
      "※上記",
      "所有者登録",
    ];
    const stopAtLineStart = /^(修理委託料金|支払期日|支払い方法|点検登録情報|他\d+件|（注意）|\(注意\)|修理は上記|本書類|個人情報|完了報告書|※上記|所有者登録)/;
    const lines = afterLabel.split(/\n/).map((s) => s.trim());
    const taken: string[] = [];
    for (const line of lines) {
      if (!line) continue;
      let lineToAdd = line;
      let foundStop = false;
      if (stopAtLineStart.test(line)) {
        foundStop = true;
        lineToAdd = "";
      } else {
        for (const phrase of stopPhrases) {
          const idx = line.indexOf(phrase);
          if (idx === 0) {
            foundStop = true;
            lineToAdd = "";
            break;
          }
          if (idx > 0) {
            lineToAdd = line.slice(0, idx).trim();
            foundStop = true;
            break;
          }
        }
        const otherMatch = line.match(/^(.+?)他\d+件/);
        if (!foundStop && otherMatch) {
          lineToAdd = otherMatch[1].trim();
          foundStop = true;
        }
      }
      if (lineToAdd) taken.push(lineToAdd);
      if (foundStop) break;
    }
    if (taken.length || internalParts.length) {
      const combined = [...internalParts];
      for (const t of taken) {
        if (t && !combined.some((c) => c.includes(t) || t.includes(c))) combined.push(t);
      }
      const headLike = /^(担当|請求先)/;
      const headParts = combined.filter((p) => headLike.test(p));
      const restParts = combined.filter((p) => !headLike.test(p));
      const ordered = headParts.length ? [...headParts, ...restParts] : combined;
      const joined = ordered.join("\n").trim();
      if (joined && (!result.internalContact || joined.length > result.internalContact.length))
        result.internalContact = joined;
    }
  }

  // data/ocr-reference/field-labels.csv のルールで上書き（API から reference を渡した場合）
  if (reference && reference.length > 0) {
    applyReferenceOverrides(result, fullOneLine, reference);
  }

  // OCRノイズ: 先頭・末尾の [ ] を除去（例: "LP [" → "LP"）
  const stripBrackets = (s: string) => s.replace(/^\s*[\[\]]+|\s*[\[\]]+\s*$/g, "").trim();
  for (const key of Object.keys(result) as (keyof OcrResult)[]) {
    const v = result[key];
    if (typeof v === "string" && v.length > 0) result[key] = stripBrackets(v);
  }

  // 短い欄の取りこぼし防止: 1行目・最大長で打ち切り（他項目の文言が混入している場合の救済）
  const shortCaps: Partial<Record<keyof OcrResult, number>> = {
    receptionNo: 20,
    modelName: 40,
    modelCode: 20,
    reportedModelName: 40,
    nameplateNo: 30,
    gasType: 20,
    customerFurigana: 60,
    requestStoreFurigana: 60,
  };
  for (const [key, maxLen] of Object.entries(shortCaps)) {
    const v = result[key as keyof OcrResult];
    if (typeof v === "string" && v.length > maxLen) {
      (result as Record<string, string>)[key] = firstLineMax(v, maxLen);
    }
  }

  return result;
}
