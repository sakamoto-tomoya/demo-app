/**
 * 簡易レート制限（同一インスタンス内・メモリ）。
 * デモ用の簡易実装です。Vercel ではインスタンスが分散するため、本番運用では
 * Upstash Redis 等の外部ストアを使ったレート制限を推奨します。
 */
const windowMs = 60 * 1000; // 1分
const maxPerWindow = 120; // 1分あたり最大リクエスト数（API全体で緩めに）

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp;
  return "unknown";
}

export function checkRateLimit(request: Request): Response | null {
  const now = Date.now();
  const id = getClientId(request);
  let entry = store.get(id);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(id, entry);
  }
  entry.count += 1;
  // 古いエントリを削除（簡易）
  if (store.size > 1000) {
    for (const [k, v] of store.entries()) {
      if (now >= v.resetAt) store.delete(k);
    }
  }
  if (entry.count > maxPerWindow) {
    return new Response(
      JSON.stringify({ error: "リクエストが多すぎます。しばらく待ってからお試しください。" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }
  return null;
}
