"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

export function RegisterClient() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const isFa = locale === "fa";
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError(t("passwordMismatch"));
      return;
    }

    setLoading(true);

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone: phone || null },
      },
    });

    if (err) {
      setError(err.message.includes("already registered") ? (isFa ? "این ایمیل قبلاً ثبت شده است." : "This email is already registered.") : t("error"));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
        <div className="mb-8"><Logo /></div>
        <div className="surface-card w-full max-w-md p-8 text-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink mx-auto">
            <svg className="h-7 w-7 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-display text-ink">{t("checkEmail")}</h2>
          <Link href="/auth/login" className="btn-primary inline-flex mt-2">{t("loginLink")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="mb-8"><Logo /></div>

      <div className="surface-card w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-display text-ink">{t("registerTitle")}</h1>
          <p className="mt-2 text-sm text-charcoal/70">{t("registerSubtitle")}</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">{t("fullName")}</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-xl border border-sand bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>

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
            <label className="block text-sm font-medium text-charcoal mb-1">{t("phone")}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">{t("passwordConfirm")}</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
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
            {loading ? t("registering") : t("registerBtn")}
          </button>
        </form>

        <p className="text-center text-sm text-charcoal/70">
          {t("hasAccount")}{" "}
          <Link href="/auth/login" className="link-accent font-medium">
            {t("loginLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
