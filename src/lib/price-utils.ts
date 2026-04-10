/**
 * 価格のパース・表示用共通ユーティリティ
 * 部品マスタの「定価」や単価を安全に数値化・日本円表示する
 */

/**
 * 各種価格表記を数値に変換する。
 * - null / undefined / "" -> null
 * - "¥4,900" / "￥700" / "300円" / "4900" -> 数値
 * - 数値はそのまま返す（NaN の場合は null）
 * - 不正値は null
 */
export function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.replace(/[¥￥,\s円]/g, "");
    if (!normalized) return null;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

/**
 * 数値を日本円表示に整形する。
 * - 4900 -> "¥4,900"
 * - 0 -> "¥0"
 * - null / undefined / NaN -> "----"
 */
export function formatYen(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "----";
  return `¥${value.toLocaleString("ja-JP")}`;
}
