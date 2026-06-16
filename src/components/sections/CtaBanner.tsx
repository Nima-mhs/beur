import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function CtaBanner() {
  const t = useTranslations("ctaBanner");

  return (
    <section className="container-content pb-8">
      <div className="surface-dark relative overflow-hidden px-8 py-14 text-center md:px-16 md:py-20">
        <div
          className="pointer-events-none absolute -bottom-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #c9a96e 0%, transparent 70%)" }}
          aria-hidden
        />
        <h2 className="relative font-display text-3xl text-gold md:text-4xl">{t("title")}</h2>
        <p className="relative mt-4 text-sand/80">{t("subtitle")}</p>
        <div className="relative mt-8 flex justify-center">
          <Link href="/services/consultation" className="btn bg-gold text-ink hover:bg-sand">
            {t("cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
