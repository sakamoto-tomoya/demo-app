/**
 * ページ画像からテンプレート種別を判定する
 * 判定用に画面上部をOCRし、「依頼元情報」等のラベルで判定
 */

import type { TemplateId } from "./extractFields-types";
import { runOcrOnBuffer } from "./extractFields";
import sharp from "sharp";

/** 判定用に使う画面上部の割合（0〜1） */
const DETECT_ZONE_HEIGHT_RATIO = 0.22;

/** 依頼元ありと判定するキーワード */
const REQUester_KEYWORDS = /依頼元情報|ご依頼店名|依頼元住所|電話番号\s*[（(]依頼|FAX\s*[（(]依頼/;

/**
 * ページ画像バッファからテンプレートを判定する
 */
export async function detectTemplate(pageImageBuffer: Buffer): Promise<TemplateId> {
  const meta = await sharp(pageImageBuffer).metadata();
  const w = meta.width ?? 1200;
  const h = meta.height ?? 1700;
  const cropHeight = Math.max(80, Math.round(h * DETECT_ZONE_HEIGHT_RATIO));

  const zone = await sharp(pageImageBuffer)
    .extract({ left: 0, top: 0, width: w, height: cropHeight })
    .jpeg({ quality: 85 })
    .toBuffer();

  const text = await runOcrOnBuffer(zone);
  if (REQUester_KEYWORDS.test(text)) return "template_with_requester";
  if (text.trim().length > 20) return "template_without_requester";
  return "unknown_template";
}
