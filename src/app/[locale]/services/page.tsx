import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type ServiceItem = {
  title: string;
  desc: string;
  cta: string;
  status: "available" | "soon";
};

function ServicesContent() {
  const t = useTranslations("servicesPage");
  const items = t.raw("items") as ServiceItem[];

  return (
    <>
      <section className="container-content py-16 md:py-20">
        <div className="max-w-2xl">
          <span className="label-eyebrow">{t("eyebrow")}</span>
          <h1 className="mt-4 text-4xl text-ink md:text-5xl">{t("title")}</h1>
          <p className="mt-5 text-charcoal">{t("subtitle")}</p>
        </div>
      </section>

      <section className="container-content pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((item) => {
            const available = item.status === "available";
            return (
              <article
                key={item.title}
                className={`flex flex-col p-8 ${available ? "surface-card" : "surface-card opacity-90"}`}
              >
                <span
                  className={`inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-medium tracking-label ${
                    available ? "bg-ink text-gold" : "border border-charcoal/30 text-charcoal"
                  }`}
                >
                  {available ? t("available") : t("comingSoon")}
                </span>
                <h2 className="mt-5 text-xl text-ink">{item.title}</h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-charcoal">{item.desc}</p>

                <div className="mt-7">
                  {available ? (
                    <Link href="/services/consultation" className="btn-primary w-full">
                      {item.cta}
                    </Link>
                  ) : (
                    <span className="btn-secondary pointer-events-none w-full opacity-60">
                      {item.cta}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ServicesContent />;
}
