"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/", key: "home" as const },
  { href: "/about", key: "about" as const },
  { href: "/services", key: "services" as const },
  { href: "/color-analysis", key: "colorAnalysis" as const },
];

export function Navbar() {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser({ email: data.user.email });
        const res = await fetch("/api/me");
        const json = await res.json();
        setIsAdmin(json.role === "admin");
      } else {
        setUser(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { email: session.user.email } : null);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-[#b29560]/85 backdrop-blur-md">
      <nav className="container-content flex h-20 items-center justify-between gap-4">
        <Logo />

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          <ul className="flex items-center gap-7 text-sm font-medium text-charcoal">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`transition-colors hover:text-ink ${isActive(l.href) ? "text-ink" : ""}`}
                >
                  {t(l.key)}
                </Link>
              </li>
            ))}
          </ul>
          <span className="h-5 w-px bg-ink/20" />
          <LanguageSwitcher />

          {user === undefined ? null : user ? (
            <div className="flex items-center gap-3">
              {isAdmin && (
                <Link href="/admin" className="btn-ghost !px-3 !py-2 text-sm text-gold">
                  ادمین
                </Link>
              )}
              <Link href="/dashboard" className="btn-secondary !px-4 !py-2 text-sm">
                {tAuth("myAccount")}
              </Link>
              <Link href="/booking" className="btn-primary !px-5 !py-2.5">
                {t("book")}
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/login" className="btn-ghost !px-4 !py-2 text-sm">
                {t("login")}
              </Link>
              <Link href="/booking" className="btn-primary !px-5 !py-2.5">
                {t("book")}
              </Link>
            </div>
          )}
        </div>

        {/* Mobile toggle */}
        <div className="flex items-center gap-3 md:hidden">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? t("close") : t("menu")}
            aria-expanded={open}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-full border border-ink/30 text-ink"
          >
            <span className={`h-px w-5 bg-ink transition-transform ${open ? "translate-y-[3px] rotate-45" : ""}`} />
            <span className={`h-px w-5 bg-ink transition-opacity ${open ? "opacity-0" : ""}`} />
            <span className={`h-px w-5 bg-ink transition-transform ${open ? "-translate-y-[3px] -rotate-45" : ""}`} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-ink/10 bg-[#b29560] md:hidden">
          <ul className="container-content flex flex-col gap-1 py-4 text-base font-medium text-ink">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-2 py-3 hover:bg-ink/5"
                >
                  {t(l.key)}
                </Link>
              </li>
            ))}
            <li className="border-t border-ink/10 pt-3 mt-1 space-y-2">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="btn-secondary w-full text-center"
                  >
                    {tAuth("myAccount")}
                  </Link>
                  <Link
                    href="/booking"
                    onClick={() => setOpen(false)}
                    className="btn-primary w-full text-center"
                  >
                    {t("book")}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="btn-ghost w-full text-center text-sm"
                  >
                    {tAuth("logout")}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    onClick={() => setOpen(false)}
                    className="btn-secondary w-full text-center"
                  >
                    {t("login")}
                  </Link>
                  <Link
                    href="/booking"
                    onClick={() => setOpen(false)}
                    className="btn-primary w-full text-center"
                  >
                    {t("book")}
                  </Link>
                </>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
