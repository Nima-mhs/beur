"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

type Booking = {
  id: string;
  service: string;
  status: "pending" | "pending_payment" | "confirmed" | "cancelled";
  full_name: string;
  email: string;
  created_at: string;
  time_slots: { starts_at: string; duration_min: number } | null;
};

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale === "fa" ? "fa-IR" : "en-GB", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  pending_payment: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500",
};

export function DashboardClient() {
  const t = useTranslations("dashboard");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      setUser({ email: data.user.email });
      fetchBookings();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchBookings() {
    const res = await fetch("/api/bookings");
    if (res.ok) {
      const data = await res.json();
      setBookings(data.bookings ?? []);
    }
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function handleCancel() {
    if (!cancelId) return;
    setCancelLoading(true);
    const res = await fetch(`/api/bookings/${cancelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    setCancelLoading(false);
    setCancelId(null);
    if (res.ok) {
      setCancelSuccess(t("cancelSuccess"));
      setBookings((prev) => prev.map((b) => b.id === cancelId ? { ...b, status: "cancelled" } : b));
      setTimeout(() => setCancelSuccess(null), 3500);
    }
  }

  function statusLabel(status: string) {
    if (status === "pending") return t("statusPending");
    if (status === "pending_payment") return t("statusPendingPayment");
    if (status === "confirmed") return t("statusConfirmed");
    return t("statusCancelled");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <section className="container-content py-12">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display text-ink">{t("title")}</h1>
            {user?.email && (
              <p className="mt-1 text-sm text-charcoal/60">{t("userEmail")}: <span dir="ltr">{user.email}</span></p>
            )}
          </div>
          <button onClick={handleLogout} className="btn-secondary !px-4 !py-2 text-sm">
            {t("logout")}
          </button>
        </div>
      </section>

      <section className="container-content pb-20 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-ink">{t("subtitle")}</h2>
          <Link href="/booking" className="btn-primary !px-4 !py-2 text-sm">{t("bookNow")}</Link>
        </div>

        {cancelSuccess && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {cancelSuccess}
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="surface-card p-10 text-center space-y-4">
            <p className="text-charcoal">{t("noBookings")}</p>
            <Link href="/booking" className="btn-primary inline-flex">{t("bookNow")}</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => (
              <div key={b.id} className="surface-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <p className="font-medium text-ink">{b.service === "personal_color_consultation"
                      ? (locale === "fa" ? "مشاوره‌ی رنگ شخصی" : "Personal Color Consultation")
                      : b.service}</p>
                    {b.time_slots && (
                      <p className="text-sm text-charcoal/70">{formatDate(b.time_slots.starts_at, locale)}</p>
                    )}
                    <p className="text-xs text-charcoal/40">{t("bookedAt")}: {formatDate(b.created_at, locale)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[b.status]}`}>
                    {statusLabel(b.status)}
                  </span>
                </div>

                <p className="text-xs text-charcoal/40 font-mono" dir="ltr">
                  {t("bookingId")}: {b.id.slice(0, 8)}…
                </p>

                {(b.status === "pending" || b.status === "pending_payment") && (
                  <button
                    onClick={() => setCancelId(b.id)}
                    className="btn-ghost !text-red-600 hover:!bg-red-50 !px-3 !py-1.5 text-sm"
                  >
                    {t("cancelBtn")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Cancel confirmation modal */}
      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="surface-card w-full max-w-sm p-6 space-y-4">
            <p className="font-medium text-ink text-center">{t("cancelConfirmMsg")}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelId(null)}
                className="btn-secondary flex-1"
              >
                {t("cancelNo")}
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelLoading}
                className="flex-1 rounded-xl bg-red-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {cancelLoading ? "..." : t("cancelYes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
