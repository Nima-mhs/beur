import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageAlternates } from "@/lib/seo";
import { AboutClient } from "./AboutClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: pageAlternates(locale, "/about"),
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AboutClient />;
}
