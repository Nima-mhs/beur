import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function AboutTeaser() {
  const t = useTranslations("aboutTeaser");

  return (
    <section className="container-content py-16 md:py-24">
      <div className="grid items-center gap-10 md:grid-cols-2">
        {/* Portrait placeholder */}
        <div className="surface-card flex aspect-[4/5] max-w-sm items-center justify-center md:order-last md:ms-auto">
          <div className="text-center text-charcoal/50">
            <div className="mx-auto mb-3 flex h-16 w-16 flex-col items-center justify-center rounded-full border border-charcoal/30">
              <span className="text-[10px] font-bold tracking-[0.2em]">BEUR</span>
              <span className="my-0.5 block h-px w-6 bg-charcoal/40" />
              <span className="text-[8px] font-light tracking-[0.3em]">SEASON</span>
            </div>
            <p className="text-xs tracking-label">PHOTO · COMING SOON</p>
          </div>
        </div>

        <div>
          <span className="label-eyebrow">{t("eyebrow")}</span>
          <h2 className="mt-4 text-3xl text-ink md:text-4xl">{t("title")}</h2>
          <p className="mt-5 leading-relaxed text-charcoal">{t("body")}</p>
          <div className="mt-8">
            <Link href="/about" className="btn-secondary">
              {t("cta")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
