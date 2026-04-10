/**
 * Azure Document Intelligence カスタムモデル専用
 * @azure/ai-form-recognizer SDK で paloma-repair-model を直接呼び出す
 */

import {
  DocumentAnalysisClient,
  AzureKeyCredential,
} from "@azure/ai-form-recognizer";
import type { OcrResult } from "@/lib/ocr-parse";
import { getEmptyOcrResult } from "@/lib/ocr-parse";

const LOG_PREFIX = "[azure-doc-intelligence]";
const CUSTOM_MODEL_ID = "paloma-repair-model";

export function isAzureDocumentIntelligenceConfigured(): boolean {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.trim();
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY?.trim();
  return Boolean(endpoint && key);
}

/** カスタムモデル抽出結果（フォーム転記用） */
export type CustomModelExtractResult = {
  // 依頼元情報
  shop_name: string;
  shop_kana: string;
  shop_manager: string;
  shop_phone: string;
  shop_fax: string;
  shop_zip: string;
  shop_address: string;
  // お客様情報
  reception_no: string;
  customer_name: string;
  customer_kana: string;
  customer_zip: string;
  customer_address: string;
  customer_phone: string;
  customer_mobile: string;
  // 製品情報
  model: string;
  model_display: string;
  gas_type: string;
  // 受付情報
  received_at: string;
  visit_date: string;
  visit_time: string;
  warranty: string;
  payment: string;
  // 内容
  inquiry: string;
  internal_note: string;
  repair_history: string;
};

/**
 * Azure Document Intelligence の DocumentField は value がネストオブジェクトのことがある。
 * （例: kind 付きの子フィールド、配列、address 型、object 型の properties など）
 * content が空でも value 側に本文があるため再帰的に文字列を取り出す。
 */
function extractDocumentFieldText(field: unknown, depth = 0): string {
  if (field == null || depth > 12) return "";
  if (typeof field === "string") return field.trim();
  if (typeof field === "number" || typeof field === "boolean") return String(field).trim();
  if (typeof field !== "object") return "";
  const o = field as Record<string, unknown>;
  if (typeof o.content === "string" && o.content.trim()) return o.content.trim();
  const val = o.value;
  if (val != null) {
    if (typeof val === "string" && val.trim()) return val.trim();
    if (typeof val === "number" || typeof val === "boolean") return String(val).trim();
    if (typeof val === "object") {
      const nested = extractDocumentFieldText(val, depth + 1);
      if (nested) return nested;
    }
  }
  for (const alt of ["valueString", "valuePhoneNumber", "text"]) {
    const x = o[alt];
    if (typeof x === "string" && x.trim()) return x.trim();
  }
  // object 型: 子フィールドが properties に入る
  if (o.properties && typeof o.properties === "object" && !Array.isArray(o.properties)) {
    const props = o.properties as Record<string, unknown>;
    const joined = Object.values(props)
      .map((v) => extractDocumentFieldText(v, depth + 1))
      .filter(Boolean)
      .join("\n");
    if (joined.trim()) return joined.trim();
  }
  if (o.valueObject && typeof o.valueObject === "object") {
    const t = extractDocumentFieldText(o.valueObject, depth + 1);
    if (t) return t;
  }
  if (Array.isArray(o.valueArray)) {
    const joined = o.valueArray
      .map((v) => extractDocumentFieldText(v, depth + 1))
      .filter(Boolean)
      .join("\n");
    if (joined.trim()) return joined.trim();
  }
  if (Array.isArray(o.values)) {
    const joined = o.values
      .map((v) => extractDocumentFieldText(v, depth + 1))
      .filter(Boolean)
      .join("\n");
    if (joined.trim()) return joined.trim();
  }
  if (Array.isArray(o.items)) {
    const joined = o.items
      .map((v) => extractDocumentFieldText(v, depth + 1))
      .filter(Boolean)
      .join("\n");
    if (joined.trim()) return joined.trim();
  }
  return "";
}

/**
 * SDK の class インスタンスは JSON.stringify で {} になることがある。
 * ログ用に列挙可能プロパティを拾ってプレーン化する。
 */
function documentFieldToLogJson(field: unknown, depth = 0): unknown {
  if (field == null || depth > 14) return field;
  if (typeof field !== "object") return field;
  const o = field as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const keys = new Set([
    ...Object.keys(o),
    ...Object.getOwnPropertyNames(o).filter((k) => !k.startsWith("_")),
  ]);
  for (const k of keys) {
    if (k.startsWith("_")) continue;
    let v: unknown;
    try {
      v = o[k];
    } catch {
      continue;
    }
    if (typeof v === "function") continue;
    if (v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.map((x) => documentFieldToLogJson(x, depth + 1));
    } else if (typeof v === "object") {
      out[k] = documentFieldToLogJson(v, depth + 1);
    }
  }
  return out;
}

function serializeFieldsForOcrLog(
  fields: Record<string, { content?: string; value?: unknown }> | undefined
): string {
  if (!fields) return "null";
  try {
    const plain: Record<string, unknown> = {};
    for (const [name, f] of Object.entries(fields)) {
      plain[name] = documentFieldToLogJson(f);
    }
    return JSON.stringify(plain, null, 2);
  } catch (e) {
    return `[serializeFieldsForOcrLog error: ${e instanceof Error ? e.message : String(e)}]`;
  }
}

function getFieldContent(
  fields: Record<string, { content?: string; value?: unknown }> | undefined,
  key: string
): string {
  const field = findFieldByFlexibleKey(fields, key);
  if (!field) return "";
  return extractDocumentFieldText(field);
}

function normalizeFieldKey(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[／⁄∕]/g, "/")
    .replace(/[・･]/g, "・")
    .replace(/\s+/g, "")
    .trim();
}

function findFieldByFlexibleKey(
  fields: Record<string, { content?: string; value?: unknown }> | undefined,
  key: string
): { content?: string; value?: unknown } | undefined {
  if (!fields) return undefined;
  // 1) まず完全一致
  if (fields[key]) return fields[key];
  // 2) Unicode正規化して一致
  const target = normalizeFieldKey(key);
  for (const [k, v] of Object.entries(fields)) {
    if (normalizeFieldKey(k) === target) return v;
  }
  // 3) 記号除去して一致（「問合/依頼内容」「問合・依頼内容」など）
  const targetLoose = target.replace(/[\/・]/g, "");
  for (const [k, v] of Object.entries(fields)) {
    const keyLoose = normalizeFieldKey(k).replace(/[\/・]/g, "");
    if (keyLoose === targetLoose) return v;
  }
  return undefined;
}

/** 複数キーを順に試し、最初に取得できた値を返す */
function getFieldContentFirst(
  fields: Record<string, { content?: string; value?: unknown }> | undefined,
  keys: string[]
): string {
  for (const key of keys) {
    const v = getFieldContent(fields, key);
    if (v) return v;
  }
  return "";
}

/**
 * キー名に「問合」「依頼内容」「症状」等を含むフィールドから、本文が最も長く取れるものを採用。
 * Object.entries の順序に依存せず、問合+依頼内容 を最優先する。
 */
function findBestInquiryField(
  fields: Record<string, { content?: string; value?: unknown }> | undefined
): { value: string; key: string } | null {
  if (!fields) return null;
  const candidates: { key: string; value: string; score: number }[] = [];
  for (const [k, raw] of Object.entries(fields)) {
    const nk = normalizeFieldKey(k);
    if (!/(問合|問い合わせ|依頼内容|症状)/u.test(nk)) continue;
    const text = extractDocumentFieldText(raw);
    if (!text.trim()) continue;
    let score = text.length;
    if (/問合/u.test(nk) && /依頼/u.test(nk)) score += 10_000_000;
    else if (/問い合わせ/u.test(nk) && /依頼/u.test(nk)) score += 9_000_000;
    else if (/問合/u.test(nk) || /問い合わせ/u.test(nk)) score += 100_000;
    else if (/依頼内容/u.test(nk)) score += 50_000;
    else if (/症状/u.test(nk)) score += 10_000;
    candidates.push({ key: k, value: text, score });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return { key: candidates[0].key, value: candidates[0].value };
}

/**
 * AnalyzeResult 全体のプレーンテキスト（フィールドの spans が参照するバッファ）。
 * 優先: result.content → paragraphs → pages[].lines
 */
function getAnalyzeResultFullText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  if (typeof r.content === "string" && r.content.length > 0) return r.content;

  const paras = r.paragraphs;
  if (Array.isArray(paras) && paras.length > 0) {
    const parts = paras
      .map((p) => {
        if (!p || typeof p !== "object") return "";
        const c = (p as Record<string, unknown>).content;
        return typeof c === "string" ? c : "";
      })
      .filter((s) => s.length > 0);
    if (parts.length > 0) return parts.join("\n");
  }

  const pages = r.pages;
  if (Array.isArray(pages)) {
    const lines: string[] = [];
    for (const page of pages) {
      if (!page || typeof page !== "object") continue;
      const plines = (page as Record<string, unknown>).lines;
      if (!Array.isArray(plines)) continue;
      for (const ln of plines) {
        if (!ln || typeof ln !== "object") continue;
        const c = (ln as Record<string, unknown>).content;
        if (typeof c === "string" && c.trim()) lines.push(c.trim());
      }
    }
    if (lines.length > 0) return lines.join("\n");
  }
  return "";
}

/** DocumentField.spans の offset/length で result.content から本文を切り出す */
function extractFieldTextFromSpans(field: unknown, fullContent: string): string {
  if (!field || typeof field !== "object" || !fullContent) return "";
  const o = field as Record<string, unknown>;
  const spans = o.spans;
  if (!Array.isArray(spans) || spans.length === 0) return "";
  const parts: string[] = [];
  for (const s of spans) {
    if (!s || typeof s !== "object") continue;
    const sp = s as Record<string, unknown>;
    const offset = typeof sp.offset === "number" ? sp.offset : Number(sp.offset);
    const length = typeof sp.length === "number" ? sp.length : Number(sp.length);
    if (!Number.isFinite(offset) || offset < 0 || !Number.isFinite(length) || length < 0) continue;
    const end = Math.min(offset + length, fullContent.length);
    if (offset < fullContent.length) parts.push(fullContent.slice(offset, end));
  }
  return parts.join("").trim();
}

/** 全文 OCR 上で「問合/依頼内容」ラベル直後〜次セクション手前までを推定 */
function extractInquiryNearLabel(fullText: string): string {
  const t = fullText.replace(/\r\n/g, "\n");
  const label = /問合\s*[／\/・･]\s*依頼内容\s*[：:＝\s]*/u;
  const m = label.exec(t);
  if (!m) return "";
  let start = m.index + m[0].length;
  while (start < t.length && /\s/u.test(t.charAt(start))) start++;
  const rest = t.slice(start);
  const stop = rest.search(
    /\n\s*(?:社内連絡|最新修理履歴|型式名|お申し出型式名|受付日|訪問希望日|訪問希望時間|ご依頼店名|お客様名|保証|支払方法)/u
  );
  const slice = stop >= 0 ? rest.slice(0, stop) : rest;
  return slice.replace(/\s+$/u, "").trim();
}

/** フィールドに本文が無いとき spans＋全文、またはラベル近傍から問合を復元 */
function resolveInquiryUsingSpansAndLayout(
  fields: Record<string, { content?: string; value?: unknown }>,
  fullText: string
): { value: string; key: string } | null {
  if (!fullText.trim()) return null;
  const orderedKeys: string[] = [];
  const seen = new Set<string>();
  const addKey = (k: string | undefined) => {
    if (!k || !fields[k] || seen.has(k)) return;
    seen.add(k);
    orderedKeys.push(k);
  };
  addKey(
    Object.keys(fields).find((k) => normalizeFieldKey(k) === normalizeFieldKey("問合/依頼内容"))
  );
  for (const k of Object.keys(fields)) {
    const nk = normalizeFieldKey(k);
    if (/問合/u.test(nk) && /依頼/u.test(nk)) addKey(k);
  }
  for (const k of Object.keys(fields)) {
    const nk = normalizeFieldKey(k);
    if (/問合/u.test(nk) || /依頼内容/u.test(nk)) addKey(k);
  }
  for (const k of orderedKeys) {
    const raw = fields[k];
    const fromSpans = extractFieldTextFromSpans(raw, fullText);
    if (fromSpans.trim()) return { value: fromSpans.trim(), key: `${k} (spans+全文)` };
  }
  const near = extractInquiryNearLabel(fullText);
  if (near) return { value: near, key: "layout:問合ラベル近傍" };
  return null;
}

/**
 * カスタムモデル（paloma-repair-model）で PDF を解析し、フィールドをマッピングして返す
 */
export async function analyzeWithCustomModel(
  pdfBuffer: Buffer
): Promise<{ success: true; data: CustomModelExtractResult } | { success: false; error: string }> {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.trim();
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY?.trim();

  if (!endpoint || !key) {
    return {
      success: false,
      error:
        "Azure Document Intelligence が未設定です。AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT と AZURE_DOCUMENT_INTELLIGENCE_KEY を設定してください。",
    };
  }

  try {
    const client = new DocumentAnalysisClient(
      endpoint,
      new AzureKeyCredential(key)
    );

    const poller = await client.beginAnalyzeDocument(CUSTOM_MODEL_ID, pdfBuffer);
    const result = await poller.pollUntilDone();
    const doc = result.documents?.[0];
    const fields = doc?.fields as Record<string, { content?: string; value?: unknown }> | undefined;

    const fullLayoutText = getAnalyzeResultFullText(result);
    console.log("[OCR] analyzeResult 全文バッファ長:", fullLayoutText.length);

    {
      const rawFieldsForInquiryLog = (result.documents?.[0]?.fields ?? {}) as Record<string, unknown>;
      const inquiryField = rawFieldsForInquiryLog["問合/依頼内容"];
      console.log(
        "[OCR] 問合フィールド全キー:",
        Object.keys((inquiryField && typeof inquiryField === "object" ? inquiryField : {}) as object)
      );
      console.log(
        "[OCR] 問合フィールド getOwnPropertyNames:",
        inquiryField && typeof inquiryField === "object"
          ? Object.getOwnPropertyNames(inquiryField as object)
          : []
      );
      if (inquiryField && typeof inquiryField === "object") {
        const spansRaw = (inquiryField as Record<string, unknown>).spans;
        console.log("[OCR] 問合フィールド spans 生:", JSON.stringify(spansRaw));
      }
      try {
        console.log("[OCR] 問合フィールド完全構造:", JSON.stringify(inquiryField, null, 2));
      } catch (e) {
        console.log("[OCR] 問合フィールド完全構造 stringify 失敗:", e);
      }
      const probe =
        inquiryField === undefined || inquiryField === null
          ? ""
          : (() => {
              try {
                return JSON.stringify(inquiryField);
              } catch {
                return "";
              }
            })();
      if (probe === "" || probe === "{}" || probe === "null") {
        console.log(
          "[OCR] 問合フィールド完全構造(プレーン化・stringifyが空のとき):",
          JSON.stringify(documentFieldToLogJson(inquiryField), null, 2)
        );
      }
      const matchedInquiryEntry = Object.entries(rawFieldsForInquiryLog).find(
        ([k]) => normalizeFieldKey(k) === normalizeFieldKey("問合/依頼内容")
      );
      if (matchedInquiryEntry) {
        const [actualKey, val] = matchedInquiryEntry;
        console.log("[OCR] 問合フィールド完全構造(正規化一致の実キー名):", actualKey);
        try {
          console.log("[OCR] 問合フィールド完全構造(実キー・JSON):", JSON.stringify(val, null, 2));
        } catch (e) {
          console.log("[OCR] 問合フィールド完全構造(実キー・JSON) 失敗:", e);
        }
        console.log(
          "[OCR] 問合フィールド完全構造(実キー・プレーン化):",
          JSON.stringify(documentFieldToLogJson(val), null, 2)
        );
      }
    }

    try {
      console.log(
        "[OCR] 全フィールド詳細:",
        JSON.stringify(result.documents?.[0]?.fields, null, 2)
      );
    } catch (logErr) {
      console.log("[OCR] 全フィールド詳細 stringify 失敗:", logErr);
    }

    /** デバッグ: キー名に 問合 / 依頼 / 症状 を含むフィールドのみ出力 */
    const fieldsForKeyScan = (result.documents?.[0]?.fields ?? {}) as Record<string, unknown>;
    Object.keys(fieldsForKeyScan).forEach((scanKey) => {
      if (scanKey.includes("問合") || scanKey.includes("依頼") || scanKey.includes("症状")) {
        const f = fieldsForKeyScan[scanKey];
        try {
          console.log("[OCR] 問合系フィールド:", scanKey, JSON.stringify(f));
        } catch {
          console.log("[OCR] 問合系フィールド:", scanKey, "(JSON.stringify 失敗)");
        }
        try {
          console.log(
            "[OCR] 問合系フィールド(プレーン化):",
            scanKey,
            JSON.stringify(documentFieldToLogJson(f), null, 2)
          );
        } catch {
          /* ignore */
        }
        try {
          console.log(
            "[OCR] 問合系 extractDocumentFieldText:",
            scanKey,
            JSON.stringify(extractDocumentFieldText(f))
          );
        } catch {
          /* ignore */
        }
      }
    });

    if (!fields) {
      console.error(`${LOG_PREFIX} ドキュメントが0件`);
      return {
        success: false,
        error: "カスタムモデルでドキュメントを抽出できませんでした。",
      };
    }

    // class インスタンス対策: 列挙プロパティをプレーン化して構造を確認しやすくする
    console.log("[OCR] Azure fields（プレーン化・デバッグ用）:");
    console.log(serializeFieldsForOcrLog(fields));

    const fieldKeys = Object.keys(fields);
    console.log("[OCR] 抽出フィールド名一覧:", fieldKeys);

    const inquiryFieldBlob = findFieldByFlexibleKey(fields, "問合/依頼内容");
    if (inquiryFieldBlob) {
      console.log("[OCR] 「問合/依頼内容」一致フィールドのプレーン化:");
      console.log(JSON.stringify(documentFieldToLogJson(inquiryFieldBlob), null, 2));
      console.log(
        "[OCR] extractDocumentFieldText(問合/依頼内容) 検証結果:",
        JSON.stringify(extractDocumentFieldText(inquiryFieldBlob))
      );
    } else {
      console.log(
        "[OCR] 「問合/依頼内容」にマッチするフィールドキーがありません（表記ゆれの可能性）。一覧:",
        fieldKeys
      );
    }

    const rawZip = getFieldContent(fields, "郵便番号");
    const digitsOnly = rawZip?.replace(/[^0-9]/g, "") ?? "";
    const customer_zip = digitsOnly
      ? digitsOnly.slice(0, 7).replace(/(\d{3})(\d{4})/, "$1-$2")
      : "";

    const inquiryKeyCandidates = [
      "問合/依頼内容",
      "問合・依頼内容",
      "依頼内容",
      "症状",
    ];
    let inquiryValue = getFieldContentFirst(fields, inquiryKeyCandidates);
    let inquirySourceKey = "";
    if (inquiryValue) {
      inquirySourceKey =
        inquiryKeyCandidates.find((k) => getFieldContent(fields, k) === inquiryValue) ?? "";
    }
    if (!inquiryValue.trim()) {
      const best = findBestInquiryField(fields);
      if (best) {
        inquiryValue = best.value;
        inquirySourceKey = best.key;
      }
    }
    if (!inquiryValue.trim() && fullLayoutText) {
      const resolved = resolveInquiryUsingSpansAndLayout(fields, fullLayoutText);
      if (resolved) {
        inquiryValue = resolved.value;
        inquirySourceKey = resolved.key;
        console.log("[OCR] inquiry フォールバック適用:", resolved.key);
        console.log(
          "[OCR] inquiry フォールバック先頭200文字:",
          JSON.stringify(resolved.value.slice(0, 200))
        );
      }
    }
    console.log("[OCR] inquiry source key:", inquirySourceKey || "(not found)");
    console.log("[OCR] inquiry raw:", inquiryValue);

    const data: CustomModelExtractResult = {
      // 依頼元情報
      shop_name: getFieldContent(fields, "ご依頼店名"),
      shop_kana: getFieldContent(fields, "フリガナ"),
      shop_manager: getFieldContent(fields, "ご担当者名"),
      shop_phone: getFieldContent(fields, "電話番号"),
      shop_fax: getFieldContentFirst(fields, ["FAX", "ファックス", "依頼元FAX"]),
      shop_zip: getFieldContent(fields, "依頼元郵便番号"),
      shop_address: getFieldContent(fields, "依頼元住所"),
      // お客様情報
      reception_no: getFieldContent(fields, "修理受付番号"),
      customer_name: getFieldContent(fields, "お客様名"),
      customer_kana: getFieldContent(fields, "お客様フリガナ"),
      customer_zip,
      customer_address: getFieldContent(fields, "住所"),
      customer_phone: getFieldContent(fields, "自宅電話"),
      customer_mobile: getFieldContent(fields, "携帯番号"),
      // 製品情報
      model: getFieldContent(fields, "型式名"),
      model_display: getFieldContent(fields, "お申し出型式名"),
      gas_type: getFieldContent(fields, "ガス種"),
      // 受付情報
      received_at: getFieldContent(fields, "受付日"),
      visit_date: getFieldContent(fields, "訪問希望日"),
      visit_time: getFieldContent(fields, "訪問希望時間"),
      warranty: getFieldContent(fields, "保証"),
      payment: getFieldContent(fields, "支払方法"),
      // 内容
      inquiry: inquiryValue,
      internal_note: getFieldContent(fields, "社内連絡"),
      repair_history: getFieldContent(fields, "最新修理履歴"),
    };

    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${LOG_PREFIX} 例外:`, message);
    return { success: false, error: message };
  }
}

/** カスタムモデル抽出結果を OcrResult（フォーム用）にマッピング */
export function mapExtractResultToOcrResult(data: CustomModelExtractResult): OcrResult {
  const empty = getEmptyOcrResult();
  return {
    ...empty,
    receptionNo: data.reception_no,
    requestStoreName: data.shop_name,
    requestStoreFurigana: data.shop_kana,
    requestContactName: data.shop_manager,
    requestPhone: data.shop_phone,
    requestFax: data.shop_fax,
    requestPostalCode: data.shop_zip,
    requestAddress: data.shop_address,
    customerName: data.customer_name,
    customerFurigana: data.customer_kana,
    postalCode: data.customer_zip,
    address: data.customer_address,
    phone: data.customer_phone,
    mobile: data.customer_mobile,
    modelName: data.model,
    reportedModelName: data.model_display,
    gasType: data.gas_type,
    receptionDate: data.received_at,
    desiredVisitDate: data.visit_date,
    desiredVisitTime: data.visit_time,
    warranty: data.warranty,
    paymentMethod: data.payment,
    inquiryContent: data.inquiry,
    inquiry_raw: data.inquiry,
    internalContact: data.internal_note,
    memo: data.repair_history,
  };
}
