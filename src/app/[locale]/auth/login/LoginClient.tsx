"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

function ForgotPasswordLink() {
  const supabase = createClient();
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [show, setShow] = useState(false);

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setSent(true);
  }

  if (!show) {
    return (
      <button type="button" onClick={() => setShow(true)} className="text-xs link-accent">
        فراموشی رمز؟
      </button>
    );
  }

  if (sent) {
    return <span className="text-xs text-green-600">لینک به ایمیل ارسال شد ✓</span>;
  }

  return (
    <form onSubmit={handleForgot} className="flex gap-1 items-center">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="ایمیل شما"
        required
        dir="ltr"
        className="rounded-lg border border-sand bg-paper px-2 py-1 text-xs text-ink outline-none focus:ring-1 focus:ring-gold/40 w-36"
      />
      <button type="submit" className="text-xs link-accent">ارسال</button>
    </form>
  );
}

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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-charcoal">{t("password")}</label>
              <ForgotPasswordLink />
            </div>
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
