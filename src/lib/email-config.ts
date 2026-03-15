import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

export type EmailConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

const CONFIG_FILE = path.join(process.cwd(), "data", "email-config.json");

function fromEnv(): Partial<EmailConfig> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || user || "";
  if (!host || !user || !pass) return {};
  return {
    host,
    port: port ? Number(port) : 587,
    user,
    pass,
    from,
  };
}

function fromFile(): Partial<EmailConfig> | null {
  try {
    if (!existsSync(CONFIG_FILE)) return null;
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    const host = typeof data.host === "string" ? data.host : "";
    const user = typeof data.user === "string" ? data.user : "";
    const pass = typeof data.pass === "string" ? data.pass : "";
    if (!host || !user || !pass) return null;
    return {
      host,
      port: typeof data.port === "number" ? data.port : Number(data.port) || 587,
      user,
      pass,
      from: typeof data.from === "string" ? data.from : user,
    };
  } catch {
    return null;
  }
}

/** 送信時に使用するメール設定（ファイル → 環境変数の順で取得。設定画面で保存した内容を優先） */
export function getEmailConfig(): EmailConfig | null {
  const fromFileConfig = fromFile();
  if (fromFileConfig?.host && fromFileConfig?.user && fromFileConfig?.pass) {
    return {
      host: fromFileConfig.host,
      port: fromFileConfig.port ?? 587,
      user: fromFileConfig.user,
      pass: fromFileConfig.pass,
      from: fromFileConfig.from || fromFileConfig.user,
    };
  }
  const fromEnvConfig = fromEnv();
  if (fromEnvConfig.host && fromEnvConfig.user && fromEnvConfig.pass) {
    return {
      host: fromEnvConfig.host,
      port: fromEnvConfig.port ?? 587,
      user: fromEnvConfig.user,
      pass: fromEnvConfig.pass,
      from: fromEnvConfig.from || fromEnvConfig.user,
    };
  }
  return null;
}

/** 設定画面用：パスワードを伏せた設定を返す（ファイル優先） */
export function getEmailConfigForDisplay(): {
  host: string;
  port: number;
  user: string;
  from: string;
  hasPassword: boolean;
  source: "env" | "file";
} | null {
  const fromFileConfig = fromFile();
  if (fromFileConfig?.host && fromFileConfig?.user) {
    return {
      host: fromFileConfig.host,
      port: fromFileConfig.port ?? 587,
      user: fromFileConfig.user,
      from: fromFileConfig.from || fromFileConfig.user,
      hasPassword: !!fromFileConfig.pass,
      source: "file",
    };
  }
  const fromEnvConfig = fromEnv();
  if (fromEnvConfig.host && fromEnvConfig.user) {
    return {
      host: fromEnvConfig.host,
      port: fromEnvConfig.port ?? 587,
      user: fromEnvConfig.user,
      from: fromEnvConfig.from || fromEnvConfig.user,
      hasPassword: !!fromEnvConfig.pass,
      source: "env",
    };
  }
  return null;
}

/** 設定をファイルに保存（設定画面から呼ばれる） */
export function saveEmailConfig(config: {
  host: string;
  port: number;
  user: string;
  pass?: string;
  from: string;
}): void {
  const dir = path.dirname(CONFIG_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const current = fromFile();
  const toWrite = {
    host: config.host.trim(),
    port: Number(config.port) || 587,
    user: config.user.trim(),
    pass: (config.pass && config.pass.trim()) || (current?.pass ?? ""),
    from: (config.from && config.from.trim()) || config.user.trim(),
  };
  writeFileSync(CONFIG_FILE, JSON.stringify(toWrite, null, 2), "utf-8");
}
