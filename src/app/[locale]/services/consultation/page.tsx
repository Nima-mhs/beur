import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Step = { title: string; desc: string };

function ConsultationContent() {
  const t = useTranslations("consultationPage");
  const features = t.raw("features") as string[];
  const steps = t.raw("steps") as Step[];

  return (
    <>
      <section className="container-content py-16 md:py-20">
        <div className="max-w-2xl">
          <span className="label-eyebrow">{t("eyebrow")}</span>
          <h1 className="mt-4 text-4xl text-ink md:text-5xl">{t("title")}</h1>
          <p className="mt-5 text-charcoal">{t("subtitle")}</p>
        </div>
      </section>

      <section className="container-content pb-8">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* What you get */}
          <article className="surface-card p-8 md:p-10">
            <h2 className="text-xl text-ink">{t("whatYouGet")}</h2>
            <ul className="mt-6 space-y-4 text-sm text-ink">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </article>

          {/* How it works */}
          <article className="surface-dark p-8 md:p-10">
            <h2 className="text-xl text-sand">{t("howTitle")}</h2>
            <ol className="mt-6 space-y-5">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/50 text-sm text-gold">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-sand">{s.title}</p>
                    <p className="mt-1 text-sm text-sand/65">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        </div>
      </section>

      {/* Booking CTA */}
      <section className="container-content py-12">
        <div className="surface-card p-10 text-center md:p-14">
          <h2 className="text-xl text-ink">{t("bookingTitle")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-charcoal">
            {t("bookingSubtitle")}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/booking" className="btn-primary">
              {t("bookCta")}
            </Link>
            <a href="mailto:info@beurseason.com" className="btn-secondary">
              {t("notifyCta")}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ConsultationContent />;
}
