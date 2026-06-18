import { setRequestLocale } from "next-intl/server";
import { AdminClient } from "./AdminClient";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminClient />;
}
