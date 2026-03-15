/**
 * 返品シール 印刷用HTML生成
 * 要件定義 4-5 出力項目・8枚で1ページ
 */

import type { ReturnLabelPage } from "./types";

const SEAL_STYLE = `
  .seal-page { page-break-after: always; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px; font-size: 11px; }
  .seal-page:last-child { page-break-after: auto; }
  .seal-item { border: 1px solid #333; padding: 8px; min-height: 80px; }
  .seal-item .label { font-size: 9px; color: #666; }
  .seal-item .value { font-weight: bold; }
  @media print { .seal-page { padding: 0; gap: 4px; } }
`;

function escapeHtml(s: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(s).replace(/[&<>"']/g, (c) => map[c] ?? c);
}

/** 返品シールのHTML文字列を生成（別窓印刷用） */
export function buildReturnLabelHtml(pages: ReturnLabelPage[]): string {
  const content = pages
    .map(
      (page) => `
    <div class="seal-page">
      ${page.items
        .map(
          (item) => `
        <div class="seal-item">
          <div class="label">受付No</div><div class="value">${escapeHtml(item.receptionNo)}</div>
          <div class="label">修理伝票No</div><div class="value">${escapeHtml(item.repairSlipNo)}</div>
          <div class="label">オーダーNo</div><div class="value">${escapeHtml(item.orderNo)}</div>
          <div class="label">部品品番</div><div class="value">${escapeHtml(item.partNumber)}</div>
          <div class="label">部品名称</div><div class="value">${escapeHtml(item.partName)}</div>
          <div class="label">完了日</div><div class="value">${escapeHtml(item.completedAt)}</div>
        </div>`
        )
        .join("")}
    </div>`
    )
    .join("");
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/><title>返品シール</title><style>${SEAL_STYLE}</style></head><body>${content}</body></html>`;
}
