"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type AboutContent = {
  photo_url: string | null;
  bio: string | null;
  resume_items: string | null;
};

export function AboutClient() {
  const t = useTranslations("about");
  const placeholderItems = t.raw("placeholderItems") as string[];
  const [content, setContent] = useState<AboutContent | null>(null);

  useEffect(() => {
    fetch("/api/about-content")
      .then((res) => (res.ok ? res.json() : { content: null }))
      .then((data) => setContent(data.content ?? null))
      .catch(() => setContent(null));
  }, []);

  const photoUrl = content?.photo_url || "/images/about/founder.jpeg";
  const bioParagraphs = content?.bio?.split("\n").filter(Boolean) ?? [];
  const resumeLines = content?.resume_items?.split("\n").filter(Boolean) ?? [];

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

      {/* Photo + bio/résumé grid */}
      <section className="container-content pb-8">
        <div className="grid items-stretch gap-8 md:grid-cols-2">
          <div className="surface-card relative aspect-[4/5] overflow-hidden">
            <Image
              src={photoUrl}
              alt={t("photoAlt")}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover object-top"
            />
          </div>

          <div className="surface-card p-8 md:p-10">
            {bioParagraphs.length > 0 ? (
              <>
                <h2 className="text-xl text-ink">{t("eyebrow")}</h2>
                <div className="mt-6 space-y-4 text-sm leading-relaxed text-charcoal">
                  {bioParagraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl text-ink">{t("placeholderTitle")}</h2>
                <ul className="mt-6 space-y-4 text-sm text-charcoal">
                  {placeholderItems.map((it) => (
                    <li key={it} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {resumeLines.length > 0 && (
              <div className="mt-8 border-t border-charcoal/10 pt-6">
                <h3 className="text-sm font-medium text-ink">{t("resumeTitle")}</h3>
                <ul className="mt-4 space-y-3 text-sm text-charcoal">
                  {resumeLines.map((line, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
