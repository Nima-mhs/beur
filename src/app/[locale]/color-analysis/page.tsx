import { setRequestLocale } from "next-intl/server";
import { ColorAnalysisClient } from "./ColorAnalysisClient";

export default async function ColorAnalysisPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ColorAnalysisClient />;
}
