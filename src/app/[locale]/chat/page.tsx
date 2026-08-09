import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageAlternates } from "@/lib/seo";
import ChatClient from "./ChatClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: pageAlternates(locale, "/chat"),
  };
}

export default async function ChatPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  return <ChatClient locale={params.locale} />;
}
