"use client";

import { useRef, useState } from "react";

const PROMPT_PRESETS = [
  { label: "内容を要約する", value: "このファイルの内容を要点ごとに箇条書きで要約してください。" },
  { label: "課題・問題点を抽出", value: "このファイルから課題や問題点を抽出し、改善案も提示してください。" },
  { label: "業務改善の提案", value: "このファイルの内容をもとに、業務効率化・自動化できる点を具体的に提案してください。" },
  { label: "報告書として整理", value: "このファイルの内容を、見やすい報告書形式に整理してまとめてください。" },
];

export default function FileAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState(PROMPT_PRESETS[0].value);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (f.type.startsWith("image/") || f.type === "application/pdf") {
      setFile(f);
      setResult("");
    } else {
      alert("画像（PNG・JPG等）またはPDFファイルをアップロードしてください。");
    }
  }

  async function analyze() {
    if (!file || loading) return;
    setLoading(true);
    setResult("");

    const form = new FormData();
    form.append("file", file);
    form.append("prompt", prompt);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setResult((prev) => prev + decoder.decode(value));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* アップロードエリア */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragOver
            ? "border-violet-400 bg-violet-500/10"
            : file
            ? "border-emerald-400/50 bg-emerald-500/5"
            : "border-white/15 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {file ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <p className="text-sm font-medium text-emerald-300">{file.name}</p>
            <p className="text-xs text-white/40">クリックで変更</p>
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-sm text-white/50">画像またはPDFをドラッグ＆ドロップ</p>
            <p className="text-xs text-white/30">またはクリックして選択</p>
          </>
        )}
      </div>

      {/* プロンプト選択 */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-white/50">分析の種類</p>
        <div className="flex flex-wrap gap-2">
          {PROMPT_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setPrompt(p.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                prompt === p.value
                  ? "border-violet-400/60 bg-violet-600/40 text-violet-200"
                  : "border-white/10 bg-white/[0.04] text-white/50 hover:border-white/20 hover:text-white/70"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 分析ボタン */}
      <button
        onClick={analyze}
        disabled={!file || loading}
        className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
      >
        {loading ? (
          <>
            <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            分析中...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            AIで分析する
          </>
        )}
      </button>

      {/* 結果表示 */}
      {result && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="mb-2 text-xs font-semibold text-violet-300">分析結果</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{result}</p>
        </div>
      )}
    </div>
  );
}
