"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";

type Message = { role: "user" | "assistant"; content: string };

export function ColorChatbot() {
  const t = useTranslations("chatbot");
  const locale = useLocale();
  const isRtl = locale === "fa";

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: t("welcome") },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message || "خطا در ارتباط با سرور." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "متأسفم، مشکلی پیش آمد. لطفاً دوباره تلاش کن." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("title")}
        className={`fixed bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-ink shadow-luxe border border-gold/40 text-gold transition-all duration-300 hover:bg-charcoal hover:scale-105 animate-pulse-glow ${
          isRtl ? "left-6" : "right-6"
        } ${open ? "rotate-0" : ""}`}
      >
        {open ? (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M8 10h.01M12 10h.01M16 10h.01" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={`fixed bottom-24 z-50 flex flex-col overflow-hidden rounded-2xl border border-sand/15 bg-ink shadow-2xl shadow-black/60 transition-all duration-300 ${
            isRtl ? "left-4 sm:left-6" : "right-4 sm:right-6"
          }`}
          style={{ width: "min(360px, calc(100vw - 2rem))", height: "min(520px, calc(100vh - 120px))" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-sand/10 bg-[#0d0d0d] px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/10 border border-gold/30">
              <svg className="h-4 w-4 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-sand">{t("title")}</p>
              <p className="text-[10px] text-gold/70">{t("subtitle")}</p>
            </div>
            <div className="ms-auto flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? (isRtl ? "justify-start" : "justify-end") : (isRtl ? "justify-end" : "justify-start")}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-gold/90 text-ink font-medium rounded-br-sm"
                      : "bg-sand/10 text-sand/90 rounded-bl-sm"
                  } ${isRtl && m.role === "user" ? "rounded-bl-sm rounded-br-2xl" : ""} ${isRtl && m.role === "assistant" ? "rounded-br-sm rounded-bl-2xl" : ""}`}
                  dir="auto"
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className={`flex ${isRtl ? "justify-end" : "justify-start"}`}>
                <div className="flex gap-1 rounded-2xl bg-sand/10 px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-sand/50 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-sand/10 p-3">
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("placeholder")}
                dir="auto"
                disabled={loading}
                className="flex-1 rounded-xl bg-sand/10 px-3 py-2 text-sm text-sand placeholder-sand/30 outline-none focus:ring-1 focus:ring-gold/40 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold text-ink transition-all hover:bg-sand disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={t("send")}
              >
                <svg className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
