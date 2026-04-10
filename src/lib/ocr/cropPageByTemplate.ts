/**
 * ページ画像をテンプレートの座標で切り出し、項目ごとの画像バッファを返す
 */

import sharp from "sharp";
import type { OcrTemplate, TemplateFieldDef } from "./extractFields-types";

export async function cropPageByTemplate(
  pageImageBuffer: Buffer,
  template: OcrTemplate
): Promise<{ key: string; buffer: Buffer }[]> {
  const meta = await sharp(pageImageBuffer).metadata();
  const imgW = meta.width ?? 1200;
  const imgH = meta.height ?? 1700;

  const out: { key: string; buffer: Buffer }[] = [];

  for (const field of template.fields) {
    const left = Math.round(field.x * imgW);
    const top = Math.round(field.y * imgH);
    const width = Math.max(1, Math.round(field.width * imgW));
    const height = Math.max(1, Math.round(field.height * imgH));

    const crop = await sharp(pageImageBuffer)
      .extract({ left, top, width, height })
      .jpeg({ quality: 88 })
      .toBuffer();

    out.push({ key: field.field_key, buffer: crop });
  }

  return out;
}
