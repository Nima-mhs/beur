"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type Message = { id: string; role: "user" | "assistant"; content: string };

function genId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function ChatClient({ locale }: { locale: string }) {
  const isRtl = locale === "fa";

  const welcome = isRtl
    ? "سلام! من دستیار هوشمند BEUR SEASON هستم 🌸\n\nمی‌توانم در موارد زیر کمک کنم:\n• مشاوره و تحلیل رنگ فصلی\n• رزرو جلسه مشاوره\n• قیمت خدمات\n• هر سوال دیگری\n\nچه سوالی دارید؟"
    : "Hello! I'm BEUR SEASON's AI assistant 🌸\n\nI can help with:\n• Color season analysis\n• Booking a consultation\n• Service pricing\n• Any other questions\n\nHow can I help you?";

  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: welcome },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(genId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [
      ...prev,
      { id: genId(), role: "user", content: text },
    ]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, locale }),
      });
      const data = await res.json();
      const reply =
        data.reply ||
        (isRtl ? "خطا در دریافت پاسخ." : "Error receiving response.");
      setMessages((prev) => [
        ...prev,
        { id: genId(), role: "assistant", content: reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: genId(),
          role: "assistant",
          content: isRtl
            ? "خطای اتصال. لطفاً دوباره تلاش کنید."
            : "Connection error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="flex flex-col min-h-screen bg-[var(--bg)]"
    >
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 border-b border-gold/20 bg-ink/95 backdrop-blur-sm">
        <div className="container-content flex items-center gap-4 py-4">
          <Link
            href={`/${locale}`}
            className="text-sm text-sand/50 hover:text-gold transition-colors"
          >
            {isRtl ? "→ خانه" : "← Home"}
          </Link>
          <div className="flex-1 flex items-center justify-center gap-2">
            <span className="font-cormorant text-gold font-semibold text-lg tracking-wide">
              BEUR SEASON
            </span>
            <span className="text-sand/30">·</span>
            <span className="text-sand/60 text-sm">
              {isRtl ? "دستیار هوشمند" : "AI Assistant"}
            </span>
          </div>
          {/* online indicator */}
          <div className="flex items-center gap-1.5 text-xs text-sand/40">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {isRtl ? "آنلاین" : "Online"}
          </div>
        </div>
      </header>

      {/* ── Messages ── */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex ${
                  isUser
                    ? isRtl
                      ? "justify-start"
                      : "justify-end"
                    : isRtl
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                {/* avatar for assistant */}
                {!isUser && (
                  <div className="flex-shrink-0 me-2 mt-1">
                    <div className="h-7 w-7 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center">
                      <svg
                        className="h-3.5 w-3.5 text-gold"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="5" />
                        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2" />
                      </svg>
                    </div>
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? "bg-gold text-ink font-medium"
                      : "bg-sand/8 text-sand border border-gold/10"
                  }`}
                  dir="auto"
                >
                  {msg.content}
                </div>
              </div>
            );
          })}

          {/* loading dots */}
          {loading && (
            <div
              className={`flex ${isRtl ? "justify-end" : "justify-start"}`}
            >
              <div className="flex-shrink-0 me-2 mt-1">
                <div className="h-7 w-7 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center">
                  <svg
                    className="h-3.5 w-3.5 text-gold"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2" />
                  </svg>
                </div>
              </div>
              <div className="bg-sand/8 border border-gold/10 rounded-2xl px-4 py-3.5">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-gold/50 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* ── Input ── */}
      <footer className="sticky bottom-0 border-t border-gold/20 bg-ink/95 backdrop-blur-sm">
        <div className="container-content max-w-2xl mx-auto py-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isRtl ? "پیام خود را بنویسید..." : "Type your message..."
              }
              disabled={loading}
              dir="auto"
              autoFocus
              className="flex-1 rounded-xl border border-gold/20 bg-charcoal/40 px-4 py-3 text-sm text-sand placeholder-sand/30 outline-none transition focus:border-gold/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-primary rounded-xl px-5 py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isRtl ? "ارسال" : "Send"}
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-sand/25">
            BEUR SEASON AI · {isRtl ? "پاسخ‌ها ممکن است خطا داشته باشند" : "Responses may contain errors"}
          </p>
        </div>
      </footer>
    </div>
  );
}
