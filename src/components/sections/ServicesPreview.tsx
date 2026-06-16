import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function ServicesPreview() {
  const t = useTranslations("servicesPreview");
  const features = t.raw("consultation.features") as string[];

  return (
    <section className="bg-ink/[0.04] py-16 md:py-24">
      <div className="container-content">
        <div className="max-w-2xl">
          <span className="label-eyebrow">{t("eyebrow")}</span>
          <h2 className="mt-4 text-3xl text-ink md:text-4xl">{t("title")}</h2>
          <p className="mt-4 text-charcoal">{t("subtitle")}</p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Consultation — primary */}
          <article className="surface-card flex flex-col p-8 md:p-10">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl text-ink">{t("consultation.title")}</h3>
              <span className="rounded-full bg-ink px-3 py-1 text-[11px] font-medium tracking-label text-gold">
                {t("consultation.tag")}
              </span>
            </div>
            <p className="mt-3 max-w-lg text-charcoal">{t("consultation.desc")}</p>

            <ul className="mt-6 space-y-3 text-sm text-ink">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 pt-2">
              <Link href="/services/consultation" className="btn-primary">
                {t("consultation.cta")}
              </Link>
            </div>
          </article>

          {/* Coming soon */}
          <article className="surface-dark flex flex-col justify-between p-8 md:p-10">
            <div>
              <span className="rounded-full border border-gold/50 px-3 py-1 text-[11px] font-medium tracking-label text-gold">
                {t("soon.badge")}
              </span>
              <h3 className="mt-5 text-2xl text-sand">{t("soon.title")}</h3>
              <p className="mt-3 text-sm leading-relaxed text-sand/70">{t("soon.desc")}</p>
            </div>
            <div className="mt-8 flex gap-1.5" aria-hidden>
              {["#c9a96e", "#e0cca7", "#b29560", "#464646"].map((c) => (
                <span key={c} className="h-2 flex-1 rounded-full" style={{ backgroundColor: c }} />
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
