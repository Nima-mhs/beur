import { setRequestLocale } from "next-intl/server";
import { ResetPasswordClient } from "./ResetPasswordClient";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ResetPasswordClient />;
}
