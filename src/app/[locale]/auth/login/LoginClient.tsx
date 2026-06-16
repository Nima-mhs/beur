"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

export function LoginClient() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const isFa = locale === "fa";
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });

    if (err) {
      setError(err.message.includes("Invalid") ? (isFa ? "ایمیل یا رمز عبور اشتباه است." : "Incorrect email or password.") : t("error"));
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="mb-8">
        <Logo />
      </div>

      <div className="surface-card w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-display text-ink">{t("loginTitle")}</h1>
          <p className="mt-2 text-sm text-charcoal/70">{t("loginSubtitle")}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">{t("email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
              className="w-full rounded-xl border border-sand bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">{t("password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              dir="ltr"
              className="w-full rounded-xl border border-sand bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-60"
          >
            {loading ? t("loggingIn") : t("loginBtn")}
          </button>
        </form>

        <p className="text-center text-sm text-charcoal/70">
          {t("noAccount")}{" "}
          <Link href="/auth/register" className="link-accent font-medium">
            {t("registerLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
