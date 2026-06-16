import { useTranslations } from "next-intl";

export function Positioning() {
  const t = useTranslations("positioning");

  return (
    <section className="container-content py-16 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <span className="label-eyebrow">{t("eyebrow")}</span>
        <p className="mt-6 font-display text-2xl leading-snug text-ink sm:text-3xl md:text-4xl">
          “{t("statement")}”
        </p>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-charcoal">
          {t("uvp")}
        </p>
      </div>
    </section>
  );
}
