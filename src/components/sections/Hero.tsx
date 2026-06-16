import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function Hero() {
  const t = useTranslations("hero");
  const brand = useTranslations("brand");

  const stats = [
    { value: t("stat1Value"), label: t("stat1Label") },
    { value: t("stat2Value"), label: t("stat2Label") },
    { value: t("stat3Value"), label: t("stat3Label") },
  ];

  return (
    <section className="relative overflow-hidden">
      {/* soft color-wheel accent */}
      <div
        className="pointer-events-none absolute -top-24 ltr:-right-24 rtl:-left-24 h-80 w-80 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #e0cca7 0%, transparent 70%)" }}
        aria-hidden
      />

      <div className="container-content relative grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
        <div className="animate-fade-up">
          <span className="label-eyebrow">{t("eyebrow")}</span>
          <h1 className="mt-5 text-4xl leading-tight text-ink sm:text-5xl md:text-6xl">
            {t("titleLine1")}
            <br />
            <span className="text-charcoal">{t("titleLine2")}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-charcoal">
            {t("subtitle")}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/services/consultation" className="btn-primary">
              {t("ctaPrimary")}
            </Link>
            <Link href="/services" className="btn-secondary">
              {t("ctaSecondary")}
            </Link>
          </div>
        </div>

        {/* Brand card */}
        <div className="animate-fade-up [animation-delay:120ms]">
          <div className="surface-dark relative mx-auto max-w-md p-10 text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 flex-col items-center justify-center rounded-full border border-gold/60 text-gold">
              <span className="text-sm font-bold tracking-[0.2em]">BEUR</span>
              <span className="my-1 block h-px w-8 bg-gold/70" />
              <span className="text-[10px] font-light tracking-[0.35em]">SEASON</span>
            </div>
            <p className="font-display text-2xl text-gold">{brand("tagline")}</p>
            <p className="mt-2 text-sm text-sand/70">{brand("taglineFa")}</p>

            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-sand/15 pt-6">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="text-sm font-bold text-gold">{s.value}</p>
                  <p className="mt-1 text-[10px] leading-tight text-sand/60">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
