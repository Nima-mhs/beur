import { setRequestLocale } from "next-intl/server";
import { BookingClient } from "./BookingClient";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BookingClient />;
}
