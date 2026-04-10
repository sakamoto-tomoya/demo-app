import { createClient, type Client } from "@libsql/client";

/**
 * Turso / libSQL クライアントの共通取得関数。
 *
 * - 環境変数から URL / トークン を読む
 * - サーバーサイドのみで使用する想定
 */
let client: Client | null = null;

export function getTursoClient(): Client {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error(
      "Turso 環境変数が未設定です。TURSO_DATABASE_URL と TURSO_AUTH_TOKEN を .env.local に設定してください。"
    );
  }

  client = createClient({ url, authToken });
  return client;
}

