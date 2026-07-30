import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ColorAnalysisClient } from "./ColorAnalysisClient";
import { pageAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "colorAnalysis" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: pageAlternates(locale, "/color-analysis"),
  };
}

export default async function ColorAnalysisPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ColorAnalysisClient />;
}
