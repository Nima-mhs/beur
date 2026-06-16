"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";

type ColorItem = { name: string; nameFa: string; hex: string };
type AnalysisResult = {
  season: "Spring" | "Summer" | "Autumn" | "Winter";
  seasonFa: string;
  undertone: "Warm" | "Cool" | "Neutral";
  undertoneFa: string;
  undertoneDescription: string;
  undertoneDescriptionFa: string;
  skinTone: string;
  skinToneFa: string;
  seasonDescription: string;
  seasonDescriptionFa: string;
  hairColors: ColorItem[];
  eyebrowColors: ColorItem[];
  makeup: {
    foundationUndertone: string;
    foundationUndertoneFa: string;
    blush: ColorItem[];
    lipstick: ColorItem[];
    eyeshadow: ColorItem[];
  };
  avoidColors: ColorItem[];
  _provider?: string;
};

const SEASON_STYLES: Record<string, { gradient: string; badge: string; text: string }> = {
  Spring:  { gradient: "from-amber-200 via-orange-100 to-yellow-100",  badge: "bg-amber-100 text-amber-800 border-amber-300",  text: "text-amber-800" },
  Summer:  { gradient: "from-rose-200 via-purple-100 to-pink-100",      badge: "bg-rose-100 text-rose-800 border-rose-300",      text: "text-rose-800"  },
  Autumn:  { gradient: "from-orange-200 via-amber-100 to-red-100",      badge: "bg-orange-100 text-orange-800 border-orange-300", text: "text-orange-800"},
  Winter:  { gradient: "from-slate-200 via-blue-100 to-indigo-100",     badge: "bg-slate-100 text-slate-800 border-slate-300",    text: "text-slate-800" },
};

const SEASON_EMOJI: Record<string, string> = {
  Spring: "🌸", Summer: "☀️", Autumn: "🍂", Winter: "❄️",
};

function ColorSwatch({ item, locale }: { item: ColorItem; locale: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="h-11 w-11 rounded-full border-2 border-white/60 shadow-md"
        style={{ backgroundColor: item.hex }}
        title={item.hex}
      />
      <span className="text-center text-[10px] leading-tight text-charcoal max-w-[52px]">
        {locale === "fa" ? item.nameFa : item.name}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-label text-charcoal">{title}</h3>
      {children}
    </div>
  );
}

export function ColorAnalysisClient() {
  const t = useTranslations("colorAnalysis");
  const locale = useLocale();
  const isFa = locale === "fa";

  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (cameraActive && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [cameraActive, stream]);

  async function startCamera() {
    setCameraError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setStream(s);
      setCameraActive(true);
    } catch {
      setCameraError(isFa ? "دسترسی به دوربین مجاز نشد. لطفاً مجوز دوربین را در مرورگر فعال کنید." : "Camera access denied. Please allow camera permission in your browser.");
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraActive(false);
  }

  function capturePhoto() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const MAX = 900;
    let { videoWidth: w, videoHeight: h } = video;
    if (w > MAX || h > MAX) {
      if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
      else { w = Math.round((w * MAX) / h); h = MAX; }
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    setPreview(dataUrl);
    setImageBase64(dataUrl.split(",")[1]);
    setMimeType("image/jpeg");
    setResult(null);
    setError(null);
    stopCamera();
  }

  const compressImage = (file: File): Promise<{ base64: string; mime: string; dataUrl: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 900;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
            else { width = Math.round((width * MAX) / height); height = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve({ base64: dataUrl.split(",")[1], mime: "image/jpeg", dataUrl });
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) { setError("File too large (max 10MB)"); return; }
    compressImage(file).then(({ base64, mime, dataUrl }) => {
      setPreview(dataUrl);
      setImageBase64(base64);
      setMimeType(mime);
      setResult(null);
      setError(null);
    }).catch(() => setError("Could not read image"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  async function analyze() {
    if (!imageBase64) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze-colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult({ ...data.analysis, _provider: data.provider });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  function sendEmail() {
    if (!result || !email) return;
    const s = SEASON_EMOJI[result.season] ?? "";
    const subject = encodeURIComponent(`BEUR SEASON — Color Analysis: ${result.season} ${s}`);
    const body = encodeURIComponent(
      `${isFa ? "نتیجه آنالیز رنگ شما" : "Your Color Analysis Result"}\n\n` +
      `${isFa ? "فصل رنگی" : "Color Season"}: ${result.season} ${s} (${result.seasonFa})\n` +
      `${isFa ? "زیرتُن" : "Undertone"}: ${isFa ? result.undertoneFa : result.undertone}\n` +
      `${isFa ? "رنگ پوست" : "Skin Tone"}: ${isFa ? result.skinToneFa : result.skinTone}\n\n` +
      `${isFa ? "رنگ مو پیشنهادی" : "Hair Colors"}: ${result.hairColors.map((c) => (isFa ? c.nameFa : c.name)).join(", ")}\n` +
      `${isFa ? "رنگ ابرو" : "Eyebrow Colors"}: ${result.eyebrowColors.map((c) => (isFa ? c.nameFa : c.name)).join(", ")}\n` +
      `${isFa ? "رژلب" : "Lipstick"}: ${result.makeup.lipstick.map((c) => (isFa ? c.nameFa : c.name)).join(", ")}\n\n` +
      `${isFa ? "این آنالیز توسط هوش مصنوعی BEUR SEASON انجام شده است." : "This analysis was performed by BEUR SEASON AI."}\n` +
      `https://beurseason.com`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  }

  const ss = result ? SEASON_STYLES[result.season] ?? SEASON_STYLES.Autumn : null;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="container-content py-14 text-center">
        <span className="label-eyebrow">{t("title")}</span>
        <h1 className="mt-4 font-display text-3xl text-ink sm:text-4xl md:text-5xl">
          {isFa ? "رنگ فصلی‌ات را کشف کن" : "Discover Your Color Season"}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-charcoal/80 text-base leading-relaxed">
          {t("subtitle")}
        </p>
      </section>

      {/* Upload + result area */}
      <section className="container-content pb-20">
        {!result ? (
          <div className="mx-auto max-w-lg space-y-6">
            {/* Camera live view */}
            {cameraActive && (
              <div className="relative rounded-3xl overflow-hidden bg-black" style={{ minHeight: 280 }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-3xl object-cover"
                  style={{ maxHeight: 340 }}
                />
                <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3">
                  <button
                    onClick={capturePhoto}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg hover:bg-sand transition-colors"
                    aria-label={t("cameraCapture")}
                  >
                    <div className="h-10 w-10 rounded-full border-4 border-ink" />
                  </button>
                  <button
                    onClick={stopCamera}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white mt-2 hover:bg-black/70 transition-colors"
                    aria-label={t("cameraStop")}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Upload zone */}
            {!cameraActive && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !preview && inputRef.current?.click()}
                className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-200 ${
                  dragging ? "border-gold bg-gold/5 scale-[1.01]" : preview ? "border-sand cursor-default" : "border-sand/60 hover:border-gold hover:bg-gold/5 cursor-pointer"
                }`}
                style={{ minHeight: 260 }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />

                {preview ? (
                  <div className="relative">
                    <img src={preview} alt="Preview" className="w-full rounded-3xl object-cover" style={{ maxHeight: 320 }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent rounded-3xl" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreview(null); setImageBase64(null); setResult(null); }}
                      className="absolute top-3 end-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                      aria-label="Remove"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 p-12">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sand/40">
                      <svg className="h-7 w-7 text-charcoal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-ink">{t("uploadTitle")}</p>
                      <p className="mt-1 text-sm text-charcoal/60">{t("uploadSubtitle")}</p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary !px-5 !py-2"
                      onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                    >
                      {t("uploadBtn")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Camera button (below upload zone when no preview) */}
            {!preview && !cameraActive && (
              <div className="flex items-center gap-3">
                <span className="flex-1 h-px bg-sand/40" />
                <span className="text-xs text-charcoal/50">{t("orTakePhoto")}</span>
                <span className="flex-1 h-px bg-sand/40" />
              </div>
            )}
            {!preview && !cameraActive && (
              <button
                type="button"
                onClick={startCamera}
                className="btn-secondary w-full gap-2"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                {t("cameraBtn")}
              </button>
            )}

            {/* Photo tips */}
            {!preview && !cameraActive && (
              <div className="rounded-2xl bg-sand/30 border border-sand/50 p-4 space-y-2">
                <p className="text-xs font-semibold text-charcoal uppercase tracking-wide">{t("photoTipsTitle")}</p>
                <ul className="space-y-1.5">
                  {([1, 2, 3, 4, 5] as const).map((n) => (
                    <li key={n} className="flex items-start gap-2 text-xs text-charcoal/70">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gold" />
                      {t(`photoTip${n}`)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(error || cameraError) && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error || cameraError}
              </div>
            )}

            {preview && (
              <button
                onClick={analyze}
                disabled={loading}
                className="btn-primary w-full gap-3 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeOpacity=".25" />
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                    </svg>
                    {t("analyzing")}
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                    {t("analyzeBtn")}
                  </>
                )}
              </button>
            )}

            {loading && (
              <p className="text-center text-sm text-charcoal/60 animate-pulse">{t("analyzingDesc")}</p>
            )}
          </div>
        ) : (
          /* ===== RESULTS ===== */
          <div className="mx-auto max-w-2xl space-y-6 animate-fade-up">
            {/* Season hero */}
            <div className={`rounded-3xl bg-gradient-to-br ${ss!.gradient} p-8 text-center`}>
              <span className="text-5xl">{SEASON_EMOJI[result.season]}</span>
              <div className="mt-3">
                <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1 text-sm font-semibold ${ss!.badge}`}>
                  {t("season")}: {isFa ? result.seasonFa : result.season}
                </span>
              </div>
              <p className={`mt-4 text-sm leading-relaxed ${ss!.text} max-w-md mx-auto`}>
                {isFa ? result.seasonDescriptionFa : result.seasonDescription}
              </p>
              {result._provider === "demo" && (
                <p className="mt-3 text-[11px] text-charcoal/50 italic">{t("demoNote")}</p>
              )}
            </div>

            {/* Undertone + Skin */}
            <div className="grid grid-cols-2 gap-3">
              <div className="surface-card p-5 text-center">
                <p className="label-eyebrow">{t("undertone")}</p>
                <p className="mt-2 text-2xl font-display text-ink">
                  {isFa ? result.undertoneFa : result.undertone}
                </p>
                <p className="mt-1 text-xs text-charcoal/70 leading-snug">
                  {isFa ? result.undertoneDescriptionFa : result.undertoneDescription}
                </p>
              </div>
              <div className="surface-card p-5 text-center">
                <p className="label-eyebrow">{t("skinTone")}</p>
                <p className="mt-2 text-lg font-medium text-ink">
                  {isFa ? result.skinToneFa : result.skinTone}
                </p>
              </div>
            </div>

            {/* Hair colors */}
            <Section title={t("hairColors")}>
              <div className="flex flex-wrap gap-4">
                {result.hairColors.map((c) => (
                  <ColorSwatch key={c.hex} item={c} locale={locale} />
                ))}
              </div>
            </Section>

            {/* Eyebrow colors */}
            <Section title={t("eyebrowColors")}>
              <div className="flex flex-wrap gap-4">
                {result.eyebrowColors.map((c) => (
                  <ColorSwatch key={c.hex} item={c} locale={locale} />
                ))}
              </div>
            </Section>

            {/* Makeup */}
            <div className="surface-card p-5 space-y-5">
              <h3 className="text-sm font-semibold uppercase tracking-label text-charcoal">{t("makeup")}</h3>

              <div>
                <p className="text-xs font-medium text-charcoal/70 mb-1">{t("foundation")}</p>
                <p className="text-sm text-ink font-medium">
                  {isFa ? result.makeup.foundationUndertoneFa : result.makeup.foundationUndertone}
                </p>
              </div>

              {(["blush", "lipstick", "eyeshadow"] as const).map((type) => (
                <div key={type}>
                  <p className="text-xs font-medium text-charcoal/70 mb-3">{t(type)}</p>
                  <div className="flex flex-wrap gap-4">
                    {result.makeup[type].map((c) => (
                      <ColorSwatch key={c.hex} item={c} locale={locale} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Avoid colors */}
            <Section title={t("avoidColors")}>
              <div className="flex flex-wrap gap-4">
                {result.avoidColors.map((c) => (
                  <div key={c.hex} className="flex flex-col items-center gap-1.5">
                    <div className="relative h-11 w-11">
                      <div
                        className="h-full w-full rounded-full border-2 border-red-300 opacity-70"
                        style={{ backgroundColor: c.hex }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </div>
                    </div>
                    <span className="text-center text-[10px] leading-tight text-charcoal max-w-[52px]">
                      {isFa ? c.nameFa : c.name}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Disclaimer */}
            <div className="rounded-xl bg-sand/40 px-4 py-3 text-center text-xs text-charcoal/70">
              {t("disclaimer")}
            </div>

            {/* Email */}
            <div className="surface-card p-5 space-y-3">
              <p className="text-sm font-medium text-ink">{t("emailLabel")}</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  dir="ltr"
                  className="flex-1 rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                />
                <button
                  onClick={sendEmail}
                  disabled={!email}
                  className="btn-secondary !px-4 !py-2 text-sm disabled:opacity-40"
                >
                  {emailSent ? "✓" : t("emailBtn")}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => { setResult(null); setPreview(null); setImageBase64(null); }}
                className="btn-secondary flex-1 text-center justify-center"
              >
                {t("tryAgain")}
              </button>
              <Link href="/services/consultation" className="btn-primary flex-1 text-center justify-center">
                {t("bookConsult")}
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
