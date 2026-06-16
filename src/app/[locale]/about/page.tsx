import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

function AboutContent() {
  const t = useTranslations("about");
  const items = t.raw("placeholderItems") as string[];

  return (
    <>
      {/* Header */}
      <section className="container-content py-16 md:py-20">
        <div className="max-w-2xl">
          <span className="label-eyebrow">{t("eyebrow")}</span>
          <h1 className="mt-4 text-4xl text-ink md:text-5xl">{t("title")}</h1>
          <p className="mt-5 text-charcoal">{t("intro")}</p>
        </div>
      </section>

      {/* Placeholder grid */}
      <section className="container-content pb-8">
        <div className="grid items-stretch gap-8 md:grid-cols-2">
          <div className="surface-card flex aspect-[4/5] items-center justify-center">
            <div className="text-center text-charcoal/50">
              <div className="mx-auto mb-3 flex h-20 w-20 flex-col items-center justify-center rounded-full border border-charcoal/30">
                <span className="text-xs font-bold tracking-[0.2em]">BEUR</span>
                <span className="my-1 block h-px w-7 bg-charcoal/40" />
                <span className="text-[9px] font-light tracking-[0.3em]">SEASON</span>
              </div>
              <p className="text-xs tracking-label">PHOTO · COMING SOON</p>
            </div>
          </div>

          <div className="surface-card p-8 md:p-10">
            <h2 className="text-xl text-ink">{t("placeholderTitle")}</h2>
            <ul className="mt-6 space-y-4 text-sm text-charcoal">
              {items.map((it) => (
                <li key={it} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="container-content py-16">
        <div className="surface-dark p-8 text-center md:p-14">
          <span className="text-[11px] font-medium uppercase tracking-label text-gold">
            {t("missionTitle")}
          </span>
          <p className="mx-auto mt-5 max-w-2xl font-display text-2xl leading-snug text-sand md:text-3xl">
            {t("mission")}
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/services/consultation" className="btn bg-gold text-ink hover:bg-sand">
              {t("cta")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AboutContent />;
}
