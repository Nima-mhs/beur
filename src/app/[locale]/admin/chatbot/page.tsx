import { setRequestLocale } from "next-intl/server";
import { ChatbotAdminClient } from "./ChatbotAdminClient";

export default async function ChatbotAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ChatbotAdminClient />;
}
