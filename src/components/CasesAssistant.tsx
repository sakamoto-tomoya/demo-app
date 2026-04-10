"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

const PRESETS = [
  "この症状の考えられる原因は？",
  "同じ型式の修理実績を教えて",
  "フォームの入力方法を教えて",
  "点火不良の一般的な原因は？",
];

interface Props {
  currentCase?: {
    modelName?: string;
    inquiryContent?: string;
    gasType?: string;
  };
  /** 外部からopenを制御する場合 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function CasesAssistant({ currentCase, open: openProp, onOpenChange }: Props) {
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    setMessages([...newMessages, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/cases-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, currentCase }),
      });
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } finally {
      setLoading(false);
    }
  }

  const panel = open && mounted
    ? createPortal(
        <div
          className="fixed inset-0 flex items-end justify-end p-4"
          style={{ zIndex: 9999, pointerEvents: "none" }}
        >
          <div
            className="flex h-[600px] w-[min(480px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f0d1f] shadow-[0_8px_40px_rgba(0,0,0,0.7)]"
            style={{ pointerEvents: "auto" }}
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between border-b border-white/10 bg-[#1a1730] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                <div>
                  <p className="text-sm font-semibold text-white">AIアシスタント</p>
                  <p className="text-xs text-white/40">完了案件データを参照して回答します</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-white/40 transition hover:bg-white/10 hover:text-white/80"
                type="button"
                aria-label="閉じる"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* メッセージ */}
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-center text-xs text-white/35">よく使う質問</p>
                  {PRESETS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left text-sm text-white/65 transition hover:border-violet-400/40 hover:bg-violet-600/15 hover:text-white/90"
                      type="button"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-violet-600/80 text-white"
                        : "bg-white/[0.07] text-white/85"
                    }`}
                  >
                    {msg.role === "assistant" && msg.content ? (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                          ul: ({ children }) => <ul className="my-1 flex flex-col gap-0.5 pl-4">{children}</ul>,
                          li: ({ children }) => <li className="list-disc">{children}</li>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : msg.content ? (
                      msg.content
                    ) : (
                      <span className="animate-pulse text-white/40">▍</span>
                    )}
                  </div>
                </div>
              ))}

              {/* 回答後の次の質問案内 */}
              {!loading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].content && (
                <div className="flex flex-col gap-1.5 border-t border-white/10 pt-3">
                  <p className="text-center text-xs text-white/30">他にご質問はありますか？</p>
                  {PRESETS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-white/50 transition hover:border-violet-400/30 hover:bg-violet-600/10 hover:text-white/80"
                      type="button"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* 入力エリア */}
            <div className="border-t border-white/10 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="症状・型式・入力方法など自由に質問…"
                  disabled={loading}
                  className="flex-1 rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:bg-white/[0.09] disabled:opacity-50"
                />
                <button
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-40"
                  type="button"
                  aria-label="送信"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return <>{panel}</>;
}
