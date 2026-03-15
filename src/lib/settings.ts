const SETTINGS_KEY = "gyoumukannri_settings";

export type FieldHandler = { name: string; email: string };

/** 入庫・出庫担当の1行分（複数行登録用） */
export type DefaultHandlerPair = {
  inboundName?: string;
  outboundName?: string;
};

export type Settings = {
  /** 受付担当者（複数可） */
  receptionHandlers: FieldHandler[];
  /** 現場処理担当者（複数可） */
  fieldHandlers: FieldHandler[];
  /** 入庫担当者（複数可） */
  inboundHandlers: FieldHandler[];
  /** 入庫担当として選択した担当者名（受付・現場のいずれかから選択） @deprecated defaultHandlerPairs を使用 */
  defaultInboundHandlerName?: string;
  /** 出庫担当として選択した担当者名（受付・現場のいずれかから選択） @deprecated defaultHandlerPairs を使用 */
  defaultOutboundHandlerName?: string;
  /** 入庫・出庫担当の組み合わせ（複数行）。先頭がデフォルトとして利用される */
  defaultHandlerPairs?: DefaultHandlerPair[];
};

export const defaultSettings: Settings = {
  receptionHandlers: [],
  fieldHandlers: [],
  inboundHandlers: [],
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<Settings> & {
      receptionName?: string;
      receptionEmail?: string;
      fieldHandlerName?: string;
      fieldHandlerEmail?: string;
    };
    const base = { ...defaultSettings, ...parsed };
    if (base.receptionHandlers == null || !Array.isArray(base.receptionHandlers)) {
      const name = parsed.receptionName?.trim();
      const email = parsed.receptionEmail?.trim() ?? "";
      base.receptionHandlers = name ? [{ name, email }] : [];
    }
    if (base.fieldHandlers == null || !Array.isArray(base.fieldHandlers)) {
      const name = parsed.fieldHandlerName?.trim();
      const email = parsed.fieldHandlerEmail?.trim() ?? "";
      base.fieldHandlers = name ? [{ name, email }] : [];
    }
    if (base.inboundHandlers == null || !Array.isArray(base.inboundHandlers)) {
      base.inboundHandlers = [];
    }
    if (base.defaultHandlerPairs == null || !Array.isArray(base.defaultHandlerPairs)) {
      const inName = (parsed as Settings).defaultInboundHandlerName?.trim();
      const outName = (parsed as Settings).defaultOutboundHandlerName?.trim();
      base.defaultHandlerPairs =
        inName || outName ? [{ inboundName: inName || undefined, outboundName: outName || undefined }] : [];
    }
    return base as Settings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: Settings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/** 設定で登録した担当者名のリスト（受付＋現場＋入庫担当者、重複除く・空除く）。案件フォーム・入庫出庫のプルダウン用 */
export function getAssigneeNames(): string[] {
  const s = loadSettings();
  const names: string[] = [];
  for (const f of s.receptionHandlers ?? []) {
    const n = f.name?.trim();
    if (n && !names.includes(n)) names.push(n);
  }
  for (const f of s.fieldHandlers ?? []) {
    const n = f.name?.trim();
    if (n && !names.includes(n)) names.push(n);
  }
  for (const f of s.inboundHandlers ?? []) {
    const n = f.name?.trim();
    if (n && !names.includes(n)) names.push(n);
  }
  return names;
}

/** 設定で登録したメールアドレスをすべて取得（受付・現場・入庫担当者、重複除く・空除く）。入庫登録時の一斉送信用 */
export function getAllRegisteredEmails(): string[] {
  const s = loadSettings();
  const emails: string[] = [];
  const add = (list: FieldHandler[] | undefined) => {
    for (const f of list ?? []) {
      const e = f.email?.trim().toLowerCase();
      if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !emails.includes(e)) emails.push(e);
    }
  };
  add(s.receptionHandlers);
  add(s.fieldHandlers);
  add(s.inboundHandlers);
  return emails;
}

/** 担当者名からメールアドレスを取得（受付・現場・入庫担当者から検索、未設定時は undefined） */
export function getEmailByAssigneeName(name: string): string | undefined {
  const n = name?.trim();
  if (!n) return undefined;
  const s = loadSettings();
  const search = (list: FieldHandler[] | undefined) =>
    (list ?? []).find((f) => f.name?.trim() === n)?.email?.trim();
  return search(s.receptionHandlers) || search(s.fieldHandlers) || search(s.inboundHandlers) || undefined;
}

/** 現場処理担当者のみのリスト（担当者別スケジュールの選択肢用。複数可） */
export function getFieldHandlerNames(): string[] {
  const s = loadSettings();
  return (s.fieldHandlers ?? []).map((f) => f.name?.trim()).filter(Boolean);
}

/** 設定で選択された入庫担当者名（未選択時は空）。defaultHandlerPairs の先頭を使用 */
export function getDefaultInboundHandlerName(): string {
  const s = loadSettings();
  const first = s.defaultHandlerPairs?.[0];
  if (first?.inboundName?.trim()) return first.inboundName.trim();
  return s.defaultInboundHandlerName?.trim() ?? "";
}

/** 設定で選択された出庫担当者名（未選択時は空）。defaultHandlerPairs の先頭を使用 */
export function getDefaultOutboundHandlerName(): string {
  const s = loadSettings();
  const first = s.defaultHandlerPairs?.[0];
  if (first?.outboundName?.trim()) return first.outboundName.trim();
  return s.defaultOutboundHandlerName?.trim() ?? "";
}
