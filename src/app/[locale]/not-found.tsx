import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("nav");
  return (
    <section className="container-content flex min-h-[50vh] flex-col items-center justify-center py-24 text-center">
      <p className="font-display text-7xl text-ink">404</p>
      <p className="mt-4 text-charcoal">BEUR SEASON</p>
      <div className="mt-8">
        <Link href="/" className="btn-primary">
          {t("home")}
        </Link>
      </div>
    </section>
  );
}
