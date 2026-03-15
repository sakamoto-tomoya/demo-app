/**
 * 部品伝票 印刷用HTML生成
 * B5横型・添付フォーマット（ヘッダー・5列テーブル・フッター・透かし）
 */

import type { PartsSlipPage } from "./types";

/** 日付を YYYY/MM/DD に整形 */
function formatDateYMD(value: string): string {
  if (!value || !value.trim()) return "";
  const d = new Date(value.trim());
  if (Number.isNaN(d.getTime())) return value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/** B5 横型（257mm × 182mm） */
const PAGE_STYLE = `
  @page { size: 257mm 182mm; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Meiryo", "Yu Gothic", sans-serif; font-size: 10pt; }
  .parts-slip-page {
    width: 257mm;
    min-height: 182mm;
    padding: 10mm;
    page-break-after: always;
    position: relative;
    background: #fff;
  }
  .parts-slip-page:last-child { page-break-after: auto; }
  .parts-slip-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 4px;
    padding-bottom: 4px;
  }
  .parts-slip-header-left { font-size: 9pt; color: #333; }
  .parts-slip-header-center { font-size: 11pt; text-align: center; flex: 1; }
  .parts-slip-header-right { font-size: 10pt; text-align: right; }
  .parts-slip-count { font-size: 10pt; margin-bottom: 6px; }
  .parts-slip-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
  }
  .parts-slip-table th,
  .parts-slip-table td {
    padding: 4px 6px;
    text-align: left;
  }
  .parts-slip-table th { font-weight: bold; }
  .parts-slip-table .num { text-align: right; }
  .parts-slip-page-number {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-size: 48pt;
    font-weight: bold;
    color: rgba(0,0,0,0.08);
    pointer-events: none;
  }
  @media print {
    body { background: #fff; }
  }
`;

const SHOP_NAME = "（みなとサービスショップ）";

/** 部品伝票のHTML文字列を生成（B5・別窓印刷用） */
export function buildPartsSlipHtml(pages: PartsSlipPage[]): string {
  const content = pages
    .map(
      (page, pageIndex) => {
        const pageNum = pageIndex + 1;
        return `
    <div class="parts-slip-page">
      <div class="parts-slip-page-number">${pageNum}</div>
      <div class="parts-slip-header">
        <div class="parts-slip-header-left">03401480</div>
        <div class="parts-slip-header-center">${escapeHtml(SHOP_NAME)}</div>
        <div class="parts-slip-header-right">${escapeHtml(page.staffName)}</div>
      </div>
      <div class="parts-slip-count">${page.items.length === 1 ? 3 : page.items.length}</div>
      <table class="parts-slip-table">
        <tbody>
          ${page.items
            .map(
              (item) => `
            <tr>
              <td>${item.sequenceNo}</td><td>${escapeHtml(item.partName)}</td><td>${escapeHtml(item.partNumber)}</td>
              <td class="num">${item.quantity}</td><td>${escapeHtml(item.orderNo)}</td>
              <td>${escapeHtml(item.receptionNo ?? "")}</td><td>${escapeHtml(formatDateYMD(item.completedAt ?? ""))}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
      }
    )
    .join("");
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/><title>部品伝票</title><style>${PAGE_STYLE}</style></head><body>${content}</body></html>`;
}

function escapeHtml(s: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(s).replace(/[&<>"']/g, (c) => map[c] ?? c);
}
