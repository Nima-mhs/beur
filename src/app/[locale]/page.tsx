import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/sections/Hero";
import { Values } from "@/components/sections/Values";
import { ServicesPreview } from "@/components/sections/ServicesPreview";
import { ColorAnalysisDemo } from "@/components/sections/ColorAnalysisDemo";
import { Positioning } from "@/components/sections/Positioning";
import { AboutTeaser } from "@/components/sections/AboutTeaser";
import { CtaBanner } from "@/components/sections/CtaBanner";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <Values />
      <ColorAnalysisDemo />
      <ServicesPreview />
      <Positioning />
      <AboutTeaser />
      <CtaBanner />
    </>
  );
}
