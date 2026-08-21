"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

function EyeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.437 0 .644C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
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
            <div className="relative" dir="ltr">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
                className="w-full rounded-xl border border-sand bg-paper px-3 py-2.5 pe-10 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                tabIndex={-1}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-charcoal/50 hover:text-charcoal"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">{t("passwordConfirm")}</label>
            <div className="relative" dir="ltr">
              <input
                type={showPasswordConfirm ? "text" : "password"}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                dir="ltr"
                className="w-full rounded-xl border border-sand bg-paper px-3 py-2.5 pe-10 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
              />
              <button
                type="button"
                onClick={() => setShowPasswordConfirm((v) => !v)}
                aria-label={showPasswordConfirm ? t("hidePassword") : t("showPassword")}
                tabIndex={-1}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-charcoal/50 hover:text-charcoal"
              >
                {showPasswordConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
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
