import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "./Logo";

export function Footer() {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 bg-ink text-sand">
      <div className="container-content grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo tone="dark" />
          <p className="max-w-xs text-sm leading-relaxed text-sand/70">{t("tagline")}</p>
        </div>

        <div className="space-y-4">
          <h3 className="text-[11px] font-medium uppercase tracking-label text-gold">{t("navTitle")}</h3>
          <ul className="space-y-2 text-sm text-sand/80">
            <li><Link href="/" className="hover:text-gold">{nav("home")}</Link></li>
            <li><Link href="/about" className="hover:text-gold">{nav("about")}</Link></li>
            <li><Link href="/services" className="hover:text-gold">{nav("services")}</Link></li>
            <li><Link href="/services/consultation" className="hover:text-gold">{nav("consultation")}</Link></li>
          </ul>
        </div>

        <div className="space-y-4">
          <h3 className="text-[11px] font-medium uppercase tracking-label text-gold">{t("contactTitle")}</h3>
          <ul className="space-y-2 text-sm text-sand/80">
            <li>
              <a href={`mailto:${t("email")}`} className="hover:text-gold" dir="ltr">{t("email")}</a>
            </li>
            <li>
              <a href="https://instagram.com/beurseason" target="_blank" rel="noreferrer" className="hover:text-gold" dir="ltr">@beurseason</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-sand/15">
        <div className="container-content flex flex-col items-center justify-between gap-2 py-6 text-xs text-sand/60 sm:flex-row">
          <p>© {year} BEUR SEASON. {t("rights")}</p>
          <p className="tracking-label">{t("builtNote")}</p>
        </div>
      </div>
    </footer>
  );
}
