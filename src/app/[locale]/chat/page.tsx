import { setRequestLocale } from "next-intl/server";
import ChatClient from "./ChatClient";

export default async function ChatPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  return <ChatClient locale={params.locale} />;
}
