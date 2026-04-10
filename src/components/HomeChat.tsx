"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function HomeChat() {
  const [open, setOpen] = useState(false);
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

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
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

  const portal = open && mounted
    ? createPortal(
        <>
          {/* 背景を完全に隠すオーバーレイ */}
          <div
            className="fixed inset-0 bg-[#06040f]"
            style={{ zIndex: 9998 }}
            aria-hidden
          />

          {/* チャットパネル */}
          <div
            className="fixed left-1/2 top-1/2 flex w-[min(860px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0d0a1f]/95 shadow-[0_8px_40px_rgba(0,0,0,0.8)]"
            style={{ zIndex: 9999, height: "min(680px, calc(100dvh - 2rem))" }}
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between border-b border-white/10 px-8 py-5">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span className="text-2xl font-semibold text-white">AIアシスタント</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/40 transition hover:text-white/80"
                aria-label="閉じる"
                type="button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* メッセージ一覧 */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-8 py-6">
              {messages.length === 0 && (
                <div className="flex flex-col gap-3 pt-2">
                  <p className="text-center text-xl text-white/40">質問を選ぶか、自由に入力してください</p>
                  {[
                    "どんな仕事ができますか？",
                    "開発実績を教えてください",
                    "AIをどう活用していますか？",
                    "どんな課題を解決できますか？",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="rounded-xl border border-white/10 bg-white/[0.05] px-6 py-5 text-center text-xl font-medium text-white/70 transition hover:border-violet-400/40 hover:bg-violet-600/20 hover:text-white/90"
                      type="button"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-6 py-5 text-xl leading-relaxed ${
                      msg.role === "user"
                        ? "bg-violet-600/80 text-white"
                        : "bg-white/[0.07] text-white/85"
                    }`}
                  >
                    {msg.role === "assistant" && msg.content ? (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                          ul: ({ children }) => <ul className="my-2 flex flex-col gap-1 pl-4">{children}</ul>,
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

              {/* 回答後に他の質問を案内 */}
              {!loading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].content && (
                <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
                  <p className="text-center text-base text-white/40">他にご質問はありますか？</p>
                  {[
                    "どんな仕事ができますか？",
                    "開発実績を教えてください",
                    "AIをどう活用していますか？",
                    "どんな課題を解決できますか？",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="rounded-xl border border-white/10 bg-white/[0.05] px-6 py-4 text-center text-lg font-medium text-white/60 transition hover:border-violet-400/40 hover:bg-violet-600/20 hover:text-white/90"
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
            <div className="border-t border-white/10 p-6">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="メッセージを入力..."
                  disabled={loading}
                  className="flex-1 rounded-xl bg-white/[0.06] px-5 py-4 text-xl text-white placeholder-white/30 outline-none focus:bg-white/[0.09] disabled:opacity-50"
                />
                <button
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  className="flex h-14 w-14 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-40"
                  aria-label="送信"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <>
      {portal}

      {/* トリガーボタン */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-violet-400/50 bg-violet-600/70 px-6 py-3 text-[15px] font-semibold text-white backdrop-blur-sm transition-all hover:bg-violet-500/80 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_16px_rgba(124,58,237,0.4)]"
        aria-label="AIに質問する"
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        どんな事が出来るかAIに質問する
      </button>
    </>
  );
}
