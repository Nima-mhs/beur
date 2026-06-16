import { useTranslations } from "next-intl";

type ValueItem = { title: string; desc: string };

const marks = ["◯", "◇", "—", "△"]; // brand shapes: circle, square/diamond, line, drop

export function Values() {
  const t = useTranslations("values");
  const items = t.raw("items") as ValueItem[];

  return (
    <section className="container-content py-16 md:py-24">
      <div className="max-w-2xl">
        <span className="label-eyebrow">{t("eyebrow")}</span>
        <h2 className="mt-4 text-3xl text-ink md:text-4xl">{t("title")}</h2>
        <p className="mt-4 text-charcoal">{t("subtitle")}</p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <article key={item.title} className="surface-card p-7">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-lg text-gold">
              {marks[i % marks.length]}
            </span>
            <h3 className="mt-5 text-lg text-ink">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-charcoal">{item.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
