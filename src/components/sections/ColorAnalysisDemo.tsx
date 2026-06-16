"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const SEASONS = [
  {
    key: "spring",
    colors: ["#F4A261", "#E9C46A", "#E76F51", "#F7D6B0", "#FFBE7A"],
    bg: "from-amber-900/60 to-orange-950/80",
    badge: "bg-amber-400/20 text-amber-300 border-amber-400/30",
    dot: "bg-amber-400",
    icon: "🌸",
  },
  {
    key: "summer",
    colors: ["#C77DFF", "#E0AAFF", "#D4A5B0", "#B8BEF0", "#E9C8D4"],
    bg: "from-purple-900/60 to-pink-950/80",
    badge: "bg-purple-400/20 text-purple-300 border-purple-400/30",
    dot: "bg-purple-400",
    icon: "☀️",
  },
  {
    key: "autumn",
    colors: ["#BC4B2A", "#8B4513", "#C47D3A", "#7B2D00", "#A0522D"],
    bg: "from-orange-900/60 to-amber-950/80",
    badge: "bg-orange-400/20 text-orange-300 border-orange-400/30",
    dot: "bg-orange-500",
    icon: "🍂",
  },
  {
    key: "winter",
    colors: ["#1C2B5E", "#6B2D6B", "#2D6B5E", "#4A0E2A", "#1A3A6B"],
    bg: "from-slate-900/60 to-blue-950/80",
    badge: "bg-blue-400/20 text-blue-300 border-blue-400/30",
    dot: "bg-blue-400",
    icon: "❄️",
  },
] as const;

type SeasonKey = (typeof SEASONS)[number]["key"];

const SEASON_KEYS: SeasonKey[] = ["spring", "summer", "autumn", "winter"];

export function ColorAnalysisDemo() {
  const t = useTranslations("colorDemo");
  const [active, setActive] = useState<SeasonKey>("autumn");
  const [phase, setPhase] = useState<"scan" | "result">("scan");
  const [swatchIdx, setSwatchIdx] = useState(0);

  const season = SEASONS.find((s) => s.key === active)!;

  useEffect(() => {
    const cycle = setInterval(() => {
      setPhase("scan");
      setSwatchIdx(0);
      setTimeout(() => {
        setActive((cur) => {
          const next = SEASON_KEYS[(SEASON_KEYS.indexOf(cur) + 1) % SEASON_KEYS.length];
          return next;
        });
        setPhase("result");
      }, 1800);
    }, 4500);
    return () => clearInterval(cycle);
  }, []);

  useEffect(() => {
    if (phase !== "result") return;
    let idx = 0;
    const t = setInterval(() => {
      idx++;
      setSwatchIdx(idx);
      if (idx >= season.colors.length) clearInterval(t);
    }, 120);
    return () => clearInterval(t);
  }, [phase, season]);

  return (
    <section className="relative overflow-hidden bg-ink py-20 md:py-28">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, #c9a96e22 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <div className="container-content relative">
        {/* Header */}
        <div className="text-center">
          <span className="label-eyebrow !text-gold/70">{t("eyebrow")}</span>
          <h2 className="mt-4 font-display text-3xl text-sand sm:text-4xl md:text-5xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sand/60 text-base leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        {/* Main demo grid */}
        <div className="mt-14 grid items-center gap-10 md:grid-cols-2 md:gap-16">
          {/* Left — animated mockup */}
          <div className="flex justify-center">
            <div className="relative w-72 sm:w-80">
              {/* Phone frame */}
              <div className="relative overflow-hidden rounded-[2.5rem] border border-sand/10 bg-[#111] shadow-2xl shadow-black/60">
                {/* Status bar */}
                <div className="flex items-center justify-between px-6 pt-4 pb-2">
                  <span className="text-[10px] text-sand/30">9:41</span>
                  <div className="h-5 w-24 rounded-full bg-black/60 border border-sand/10" />
                  <span className="text-[10px] text-sand/30">●●●</span>
                </div>

                {/* App header */}
                <div className="px-5 pb-2">
                  <p className="text-[10px] font-medium tracking-widest text-gold/70 uppercase">
                    BEUR SEASON · Color AI
                  </p>
                </div>

                {/* Face analysis area */}
                <div className={`relative mx-4 overflow-hidden rounded-2xl bg-gradient-to-b ${season.bg} transition-all duration-700`} style={{ height: 200 }}>
                  {/* Oval face outline */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-28 rounded-full border-2 border-sand/20 bg-sand/5" />
                  {/* Scan line */}
                  {phase === "scan" && (
                    <div
                      className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent animate-scan opacity-80"
                      style={{ animationDuration: "1.6s" }}
                    />
                  )}
                  {/* Season badge */}
                  {phase === "result" && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 animate-fade-up">
                      <span className={`text-[10px] font-medium px-3 py-1 rounded-full border ${season.badge}`}>
                        {season.icon} {t(season.key)}
                      </span>
                    </div>
                  )}
                  {/* Corner dots */}
                  {["top-2 left-2", "top-2 right-2", "bottom-2 left-2", "bottom-2 right-2"].map((pos) => (
                    <div key={pos} className={`absolute ${pos} w-2 h-2 rounded-full border border-gold/40`} />
                  ))}
                </div>

                {/* Color swatches row */}
                <div className="flex items-center gap-2 px-5 py-4">
                  {season.colors.map((hex, i) => (
                    <div
                      key={`${active}-${i}`}
                      className="h-8 w-8 rounded-full border-2 border-white/10 transition-all"
                      style={{
                        backgroundColor: hex,
                        opacity: i < swatchIdx ? 1 : 0.15,
                        transform: i < swatchIdx ? "scale(1)" : "scale(0.7)",
                        transition: "all 0.3s ease",
                      }}
                    />
                  ))}
                </div>

                {/* Result labels */}
                <div className="px-5 pb-5 space-y-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-sand/40">Undertone</span>
                    <span className="text-sand/70 font-medium">
                      {active === "spring" || active === "autumn" ? "Warm 🟡" : "Cool 🔵"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-sand/40">Best hair</span>
                    <span className="text-sand/70 font-medium">
                      {active === "spring" ? "Golden Blonde" : active === "summer" ? "Ash Brown" : active === "autumn" ? "Auburn" : "Jet Black"}
                    </span>
                  </div>
                  <div className="h-px bg-sand/10 mt-3" />
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 h-6 rounded-full bg-sand/10 flex items-center justify-center">
                      <span className="text-[9px] text-sand/50">Makeup palette</span>
                    </div>
                    <div
                      className="h-6 w-6 rounded-full border border-gold/30"
                      style={{ backgroundColor: season.colors[2] }}
                    />
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -top-3 -right-3 rtl:-right-auto rtl:-left-3 bg-gold text-ink text-[10px] font-bold px-2 py-1 rounded-full animate-pulse-glow">
                {t("badge")}
              </div>
            </div>
          </div>

          {/* Right — season cards + CTA */}
          <div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {SEASONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    setActive(s.key);
                    setPhase("result");
                    setSwatchIdx(s.colors.length);
                  }}
                  className={`group relative overflow-hidden rounded-2xl border p-4 text-start transition-all duration-300 ${
                    active === s.key
                      ? "border-gold/50 bg-sand/10 shadow-lg shadow-gold/10"
                      : "border-sand/10 bg-sand/5 hover:border-sand/20"
                  }`}
                >
                  <div className="mb-2 text-xl">{s.icon}</div>
                  <p className="text-sm font-semibold text-sand">{t(s.key)}</p>
                  <p className="mt-0.5 text-[11px] text-sand/50">{t(`${s.key}Desc` as Parameters<typeof t>[0])}</p>
                  <div className="mt-3 flex gap-1.5">
                    {s.colors.slice(0, 4).map((c) => (
                      <div
                        key={c}
                        className="h-4 w-4 rounded-full border border-white/10 transition-transform group-hover:scale-110"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  {active === s.key && (
                    <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${s.dot}`} />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-8 space-y-4">
              <Link href="/color-analysis" className="btn-primary w-full sm:w-auto text-center flex items-center justify-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                  <path d="M11 8v6M8 11h6" />
                </svg>
                {t("cta")}
              </Link>
              <p className="text-[11px] text-sand/40">
                بدون نیاز به ثبت‌نام · رایگان · هوش مصنوعی
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
