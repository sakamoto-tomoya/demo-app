"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "month_end_vba_path";

export default function MonthEndPage() {
  const [vbaPath, setVbaPath] = useState("");
  const [saved, setSaved] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setVbaPath(stored);
  }, []);

  const handleSavePath = () => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, vbaPath.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleOpenVba = async () => {
    const path = (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null) || vbaPath.trim();
    if (!path) {
      alert("先にExcelファイルのパスを入力し「パスを保存」を押してください。");
      return;
    }
    setCopyMessage("");
    const fileUrl = path.startsWith("file://") ? path : "file:///" + path.replace(/\\/g, "/").replace(/^\/+/, "");
    window.open(fileUrl, "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(path);
      setCopyMessage("パスをコピーしました。開けない場合は Excel の「ファイル→開く」に貼り付けてください。");
      setTimeout(() => setCopyMessage(""), 5000);
    } catch {
      setCopyMessage("パス: " + path + " （このパスをコピーして Excel で開いてください）");
      setTimeout(() => setCopyMessage(""), 8000);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">
        月末処理
      </h1>
      <p className="text-[var(--muted)]">
        VBA（Excelマクロ）を開くには、あらかじめExcelファイルのパスを設定してください。ボタンでそのファイルを開きます。
      </p>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-[var(--foreground)]">Excelファイルのパス（VBA入り .xlsm 等）</span>
          <input
            type="text"
            value={vbaPath}
            onChange={(e) => setVbaPath(e.target.value)}
            onBlur={handleSavePath}
            placeholder="例: C:\Users\あなた\Documents\月末処理.xlsm"
            className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
          />
        </label>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={handleSavePath}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)]"
          >
            パスを保存
          </button>
          {saved && <span className="text-sm text-[var(--muted)]">保存しました</span>}
        </div>
        <div className="pt-2 border-t border-[var(--border)] space-y-2">
          <button
            type="button"
            onClick={handleOpenVba}
            className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
          >
            無償援助金VBA
          </button>
          {copyMessage && (
            <p className="text-sm text-[var(--primary)] font-medium">
              {copyMessage}
            </p>
          )}
        </div>
        <p className="text-xs text-[var(--muted)]">
          ブラウザのセキュリティにより file:// が開けない場合があります。その場合は、上記パスをコピーして Excel の「ファイル→開く」で指定してください。
        </p>
      </div>
    </div>
  );
}
