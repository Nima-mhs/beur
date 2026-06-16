"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useTransition } from "react";

const labels: Record<string, string> = {
  fa: "FA",
  en: "EN",
};

export function LanguageSwitcher({ tone = "light" }: { tone?: "dark" | "light" }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const base =
    tone === "dark" ? "text-sand/70" : "text-charcoal";
  const active = tone === "dark" ? "text-gold" : "text-ink";

  function switchTo(next: string) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next as (typeof routing.locales)[number] });
    });
  }

  return (
    <div className={`flex items-center gap-1 text-xs font-medium tracking-label ${isPending ? "opacity-50" : ""}`}>
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span className={`mx-1 ${base} opacity-40`}>/</span>}
          <button
            type="button"
            onClick={() => switchTo(l)}
            className={`transition-colors hover:opacity-100 ${l === locale ? active : `${base} opacity-70`}`}
            aria-current={l === locale ? "true" : undefined}
          >
            {labels[l]}
          </button>
        </span>
      ))}
    </div>
  );
}
