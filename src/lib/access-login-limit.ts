/**
 * ログイン試行の簡易制限（同一IPで失敗回数が多い場合は一時的に 429 を返す）。
 * メモリ実装のため Vercel ではインスタンスごと。本番では Redis 等の利用を推奨。
 */
const WINDOW_MS = 15 * 60 * 1000; // 15分
const MAX_FAILURES = 5;

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp;
  return "unknown";
}

/** 失敗を記録し、制限超過なら true を返す（呼び出し元で 429 を返す） */
export function recordFailure(request: Request): boolean {
  const now = Date.now();
  const id = getClientId(request);
  let entry = store.get(id);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(id, entry);
  }
  entry.count += 1;
  if (store.size > 2000) {
    for (const [k, v] of store.entries()) {
      if (now >= v.resetAt) store.delete(k);
    }
  }
  return entry.count > MAX_FAILURES;
}

/** 制限超過かどうかだけを返す（記録はしない） */
export function isOverLimit(request: Request): boolean {
  const now = Date.now();
  const id = getClientId(request);
  const entry = store.get(id);
  if (!entry || now >= entry.resetAt) return false;
  return entry.count > MAX_FAILURES;
}

/** ログイン成功時に呼び、該当 IP の失敗カウントをリセット */
export function clearFailures(request: Request): void {
  const id = getClientId(request);
  store.delete(id);
}
