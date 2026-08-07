"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

type Slot = {
  id: string;
  starts_at: string;
  duration_min: number;
  price_irr?: number;
};

type PaymentSettings = {
  consultation_duration_min: number;
  consultation_price_irr: number;
  consultation_price_usd: number | null;
  irr_bank_name: string | null;
  irr_card_number: string | null;
  irr_account_holder: string | null;
  intl_card_brand: string | null;
  intl_card_number: string | null;
  intl_account_holder: string | null;
};

type Step = 1 | 2 | 3 | 4;

function StepIndicator({ step, t }: { step: Step; t: ReturnType<typeof useTranslations> }) {
  const steps = [t("step1Label"), t("step2Label"), t("step3Label"), t("step4Label")];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all ${
              done ? "bg-ink text-gold" : active ? "bg-gold text-ink" : "border border-sand/60 text-charcoal/50"
            }`}>
              {done ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : n}
            </div>
            <span className={`hidden sm:block text-xs ${active ? "text-ink font-medium" : "text-charcoal/50"}`}>{label}</span>
            {i < 3 && <span className="w-6 h-px bg-sand/40" />}
          </div>
        );
      })}
    </div>
  );
}

function formatSlotDate(iso: string, locale: string) {
  const d = new Date(iso);
  return d.toLocaleString(locale === "fa" ? "fa-IR" : "en-GB", {
    timeZone: "Asia/Tehran",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Calendar-day key (Tehran-local) used to bucket slots by day, independent of display locale.
function tehranDateKey(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
}

function formatDayHeader(d: Date, locale: string) {
  return d.toLocaleDateString(locale === "fa" ? "fa-IR" : "en-GB", {
    timeZone: "Asia/Tehran",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatSlotTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "fa" ? "fa-IR" : "en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWeekRange(start: Date, end: Date, locale: string) {
  const loc = locale === "fa" ? "fa-IR" : "en-GB";
  const opts: Intl.DateTimeFormatOptions = { timeZone: "Asia/Tehran", day: "numeric", month: "long" };
  return `${start.toLocaleDateString(loc, opts)} – ${end.toLocaleDateString(loc, opts)}`;
}

export function BookingClient() {
  const t = useTranslations("booking");
  const locale = useLocale();
  const isFa = locale === "fa";
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);

  const [step, setStep] = useState<Step>(1);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  // Step 2 — details
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email } : null);
      if (data.user?.email) setEmail(data.user.email);
      const meta = data.user?.user_metadata;
      if (meta?.full_name) setFullName(meta.full_name);
      if (meta?.phone) setPhone(meta.phone);
      setAuthLoading(false);
    });
  }, [supabase]);

  useEffect(() => {
    fetch("/api/time-slots")
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .finally(() => setSlotsLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/payment-settings")
      .then((r) => r.json())
      .then((d) => setPaymentSettings(d.settings ?? null));
  }, []);

  const weekDays = useMemo(() => {
    const todayKey = tehranDateKey(new Date());
    const start = new Date(`${todayKey}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      return d;
    });
  }, [weekOffset]);

  const slotsByDay = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    for (const slot of slots) {
      const key = tehranDateKey(new Date(slot.starts_at));
      (map[key] ??= []).push(slot);
    }
    return map;
  }, [slots]);

  const weekHasSlots = weekDays.some((d) => (slotsByDay[tehranDateKey(d)] ?? []).length > 0);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <div className="surface-card max-w-md w-full p-8 text-center space-y-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sand/40 mx-auto">
            <svg className="h-7 w-7 text-charcoal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h2 className="text-xl font-display text-ink">{t("loginRequired")}</h2>
          <Link href="/auth/login" className="btn-primary w-full text-center justify-center">
            {t("loginToBook")}
          </Link>
          <Link href="/auth/register" className="btn-secondary w-full text-center justify-center">
            {isFa ? "ثبت‌نام جدید" : "Create an account"}
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmitBooking() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: selectedSlot.id, full_name: fullName, email, phone, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : (isFa ? "خطایی رخ داد" : "Something went wrong"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <section className="container-content py-12 pb-4">
        <h1 className="text-3xl font-display text-ink text-center">{t("title")}</h1>
        <p className="mt-2 text-center text-charcoal/70 text-sm">{t("subtitle")}</p>
      </section>

      <section className="container-content pb-20">
        <div className={`mx-auto ${step === 1 ? "max-w-5xl" : "max-w-xl"}`}>
          <StepIndicator step={step} t={t} />

          {/* Step 1 — choose slot */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-ink text-center">{t("chooseSlotTitle")}</h2>

              {slotsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="h-7 w-7 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                </div>
              ) : slots.length === 0 ? (
                <div className="surface-card p-8 text-center space-y-4">
                  <p className="text-charcoal">{t("noSlots")}</p>
                  <a href="mailto:info@beurseason.com" className="btn-secondary inline-flex">
                    {t("contactForBooking")}
                  </a>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                      disabled={weekOffset === 0}
                      className="btn-ghost !px-3 !py-1.5 text-xs sm:text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {isFa ? "‹ هفته قبل" : "‹ Prev"}
                    </button>
                    <span className="text-xs sm:text-sm text-charcoal/70 font-medium">
                      {formatWeekRange(weekDays[0], weekDays[6], locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setWeekOffset((w) => w + 1)}
                      className="btn-ghost !px-3 !py-1.5 text-xs sm:text-sm"
                    >
                      {isFa ? "هفته بعد ›" : "Next ›"}
                    </button>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 sm:grid sm:grid-cols-7 sm:overflow-visible sm:mx-0 sm:px-0">
                    {weekDays.map((day) => {
                      const key = tehranDateKey(day);
                      const daySlots = slotsByDay[key] ?? [];
                      const isToday = key === tehranDateKey(new Date());
                      return (
                        <div key={key} className="surface-card flex-shrink-0 w-[128px] sm:w-auto p-2.5 space-y-2">
                          <div className={`text-center text-[11px] font-medium pb-2 border-b border-sand/40 ${isToday ? "text-gold-dark" : "text-ink"}`}>
                            {formatDayHeader(day, locale)}
                          </div>
                          {daySlots.length === 0 ? (
                            <p className="text-center text-xs text-charcoal/30 py-3">—</p>
                          ) : (
                            <div className="space-y-1.5">
                              {daySlots.map((slot) => (
                                <button
                                  key={slot.id}
                                  type="button"
                                  onClick={() => { setSelectedSlot(slot); setStep(2); }}
                                  className="w-full rounded-lg bg-sand/30 hover:bg-ink hover:text-gold text-ink text-xs font-medium py-2 transition-colors"
                                >
                                  {formatSlotTime(slot.starts_at, locale)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {!weekHasSlots && (
                    <p className="text-center text-sm text-charcoal/50 py-2">{t("noSlotsThisWeek")}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2 — details */}
          {step === 2 && (
            <div className="surface-card p-6 space-y-5">
              <h2 className="text-lg font-medium text-ink">{t("detailsTitle")}</h2>

              {selectedSlot && (
                <div className="rounded-xl bg-sand/30 px-4 py-3 text-sm">
                  <span className="text-charcoal/60">{t("selectedTime")}: </span>
                  <span className="font-medium text-ink">{formatSlotDate(selectedSlot.starts_at, locale)}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">{t("fullName")} *</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-sand bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">{t("email")} *</label>
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
                  <label className="block text-sm font-medium text-charcoal mb-1">{t("notes")}</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-sand bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">{t("back")}</button>
                <button
                  onClick={() => { if (fullName && email) setStep(3); }}
                  disabled={!fullName || !email}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {t("next")}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — payment */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="surface-dark p-6 space-y-5">
                <h2 className="text-lg font-medium text-sand">{t("paymentTitle")}</h2>
                <p className="text-sm text-sand/70">{t("paymentSubtitle")}</p>

                {!paymentSettings ? (
                  <div className="flex justify-center py-4">
                    <div className="h-6 w-6 border-2 border-sand border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : isFa ? (
                  <>
                    <div className="rounded-xl bg-gold/10 border border-gold/30 p-4 space-y-2">
                      <p className="text-gold font-semibold text-lg">
                        مبلغ: {(((selectedSlot?.price_irr ?? paymentSettings.consultation_price_irr) / 10)).toLocaleString("fa-IR")} تومان
                      </p>
                    </div>

                    {paymentSettings.irr_card_number ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center border-b border-sand/10 pb-2">
                          <span className="text-sand/60">بانک</span>
                          <span className="text-sand font-medium">{paymentSettings.irr_bank_name}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-sand/10 pb-2">
                          <span className="text-sand/60">شماره کارت</span>
                          <span className="text-sand font-medium ltr" dir="ltr">{paymentSettings.irr_card_number}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2">
                          <span className="text-sand/60">صاحب حساب</span>
                          <span className="text-sand font-medium">{paymentSettings.irr_account_holder}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-sand/10 p-4 text-sm text-sand/70">
                        اطلاعات واریز هنوز تنظیم نشده — لطفاً برای هماهنگی پرداخت با ما تماس بگیرید.
                      </div>
                    )}

                    <div className="rounded-xl bg-sand/10 p-3 text-xs text-sand/60">
                      {t("paymentReceiptNote")}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl bg-gold/10 border border-gold/30 p-4 space-y-2">
                      <p className="text-gold font-semibold text-lg">
                        {paymentSettings.consultation_price_usd != null
                          ? `Amount: $${paymentSettings.consultation_price_usd}`
                          : "Amount: contact us for pricing"}
                      </p>
                    </div>

                    {paymentSettings.intl_card_number ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center border-b border-sand/10 pb-2">
                          <span className="text-sand/60">Card</span>
                          <span className="text-sand font-medium">{paymentSettings.intl_card_brand}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-sand/10 pb-2">
                          <span className="text-sand/60">Number</span>
                          <span className="text-sand font-medium ltr" dir="ltr">{paymentSettings.intl_card_number}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2">
                          <span className="text-sand/60">Account holder</span>
                          <span className="text-sand font-medium">{paymentSettings.intl_account_holder}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-sand/10 p-4 text-sm text-sand/70">
                        International payment isn&apos;t set up yet — please contact us to arrange payment.
                      </div>
                    )}

                    <div className="rounded-xl bg-sand/10 p-3 text-xs text-sand/60">
                      {t("paymentReceiptNote")}
                    </div>
                  </>
                )}
              </div>

              {/* Add receipt note to notes */}
              <div className="surface-card p-4 space-y-2">
                <label className="block text-sm font-medium text-charcoal">{isFa ? "شماره پیگیری واریز (اختیاری)" : "Transfer reference / receipt no. (optional)"}</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isFa ? "مثال: ۱۲۳۴۵۶۷۸" : "e.g. 12345678"}
                  dir="ltr"
                  className="w-full rounded-xl border border-sand bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-secondary flex-1">{t("back")}</button>
                <button
                  onClick={handleSubmitBooking}
                  disabled={submitting}
                  className="btn-primary flex-1 disabled:opacity-60"
                >
                  {submitting ? t("submitting") : t("iHavePaid")}
                </button>
              </div>
            </div>
          )}

          {/* Step 4 — success */}
          {step === 4 && (
            <div className="surface-card p-8 text-center space-y-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink mx-auto">
                <svg className="h-8 w-8 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-display text-ink">{t("successTitle")}</h2>
              <p className="text-charcoal/70 text-sm leading-relaxed">{t("successDesc")}</p>
              {selectedSlot && (
                <div className="rounded-xl bg-sand/30 px-4 py-3 text-sm">
                  <span className="text-charcoal/60">{t("selectedTime")}: </span>
                  <span className="font-medium text-ink">{formatSlotDate(selectedSlot.starts_at, locale)}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link href="/dashboard" className="btn-secondary flex-1 text-center justify-center">{t("myBookings")}</Link>
                <Link href="/" className="btn-primary flex-1 text-center justify-center">{t("backToHome")}</Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
