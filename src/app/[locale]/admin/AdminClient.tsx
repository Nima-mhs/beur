"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────

type Booking = {
  id: string;
  status: string;
  full_name: string;
  email: string;
  phone?: string;
  notes?: string;
  meeting_link?: string;
  created_at: string;
  time_slots: { starts_at: string; price_irr?: number } | null;
};

type Slot = {
  id: string;
  starts_at: string;
  duration_min: number;
  available: boolean;
  price_irr?: number;
};

type SlotTemplate = {
  id: string;
  day_of_week: number;
  time_of_day: string;
  duration_min: number;
  price_irr?: number;
  active: boolean;
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

type AboutContent = {
  photo_url: string | null;
  bio: string | null;
  resume_items: string | null;
};

type Lead = {
  id: string;
  session_id?: string;
  name?: string;
  phone?: string;
  email?: string;
  interest?: string;
  source?: string;
  created_at: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleString("fa-IR", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "در انتظار پرداخت",
  confirmed: "تأیید شده ✓",
  completed: "انجام شده",
  cancelled: "لغو شده",
  refunded: "بازگشت وجه",
};

const STATUS_COLOR: Record<string, string> = {
  pending_payment: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-gray-100 text-gray-500",
  refunded: "bg-amber-100 text-amber-800",
};

// JS Date.getDay() convention (0=Sunday..6=Saturday), ordered for display starting Saturday.
const DAY_OPTIONS = [
  { value: 6, label: "شنبه" },
  { value: 0, label: "یکشنبه" },
  { value: 1, label: "دوشنبه" },
  { value: 2, label: "سه‌شنبه" },
  { value: 3, label: "چهارشنبه" },
  { value: 4, label: "پنجشنبه" },
  { value: 5, label: "جمعه" },
];

function dayLabel(day: number) {
  return DAY_OPTIONS.find((d) => d.value === day)?.label ?? String(day);
}

// ── Component ──────────────────────────────────────────────────────────────

export function AdminClient() {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<"bookings" | "slots" | "leads" | "payment" | "about">("bookings");
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  // Bookings state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [newLink, setNewLink] = useState("");
  const [savingBooking, setSavingBooking] = useState(false);

  // Slots state
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotTime, setNewSlotTime] = useState("10:00");
  const [newSlotDuration, setNewSlotDuration] = useState(60);
  const [newSlotPrice, setNewSlotPrice] = useState(5000000);
  const [addingSlot, setAddingSlot] = useState(false);

  // Recurring templates state
  const [templates, setTemplates] = useState<SlotTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [newTemplateDay, setNewTemplateDay] = useState(6);
  const [newTemplateTime, setNewTemplateTime] = useState("10:00");
  const [newTemplateDuration, setNewTemplateDuration] = useState(60);
  const [newTemplatePrice, setNewTemplatePrice] = useState(5000000);
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [generateWeeks, setGenerateWeeks] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);

  // Leads state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  // Payment settings state
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentSaveResult, setPaymentSaveResult] = useState<string | null>(null);

  // About page content state
  const [aboutContent, setAboutContent] = useState<AboutContent | null>(null);
  const [aboutLoading, setAboutLoading] = useState(false);
  const [savingAbout, setSavingAbout] = useState(false);
  const [aboutSaveResult, setAboutSaveResult] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadResult, setPhotoUploadResult] = useState<string | null>(null);

  // ── Auth check ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

      // Check admin role via API (uses service client, bypasses RLS)
      const { data: { session } } = await supabase.auth.getSession();
      const meRes = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      const meJson = await meRes.json();

      if (meJson.role !== "admin") {
        setAuthorized(false);
        return;
      }

      setAuthorized(true);
      const res = await fetch("/api/admin/bookings");
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings ?? []);
      }
    }
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Data fetchers ────────────────────────────────────────────────────────

  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true);
    const res = await fetch("/api/admin/bookings");
    if (res.ok) setBookings((await res.json()).bookings ?? []);
    setBookingsLoading(false);
  }, []);

  const fetchSlots = useCallback(async () => {
    setSlotsLoading(true);
    const res = await fetch("/api/admin/slots");
    if (res.ok) setSlots((await res.json()).slots ?? []);
    setSlotsLoading(false);
  }, []);

  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true);
    const res = await fetch("/api/admin/leads");
    if (res.ok) setLeads((await res.json()).leads ?? []);
    setLeadsLoading(false);
  }, []);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    const res = await fetch("/api/admin/slot-templates");
    if (res.ok) setTemplates((await res.json()).templates ?? []);
    setTemplatesLoading(false);
  }, []);

  const fetchPaymentSettings = useCallback(async () => {
    setPaymentLoading(true);
    const res = await fetch("/api/admin/payment-settings");
    if (res.ok) {
      const s = (await res.json()).settings as PaymentSettings | null;
      setPaymentSettings(s);
      if (s) {
        setNewSlotDuration(s.consultation_duration_min);
        setNewSlotPrice(s.consultation_price_irr);
        setNewTemplateDuration(s.consultation_duration_min);
        setNewTemplatePrice(s.consultation_price_irr);
      }
    }
    setPaymentLoading(false);
  }, []);

  const fetchAboutContent = useCallback(async () => {
    setAboutLoading(true);
    const res = await fetch("/api/admin/about-content");
    if (res.ok) {
      setAboutContent((await res.json()).content ?? { photo_url: null, bio: null, resume_items: null });
    } else {
      // Table not migrated yet in Supabase — still let the admin see the form.
      setAboutContent({ photo_url: null, bio: null, resume_items: null });
    }
    setAboutLoading(false);
  }, []);

  useEffect(() => {
    if (!authorized) return;
    if (tab === "bookings") fetchBookings();
    if (tab === "slots") { fetchSlots(); fetchTemplates(); fetchPaymentSettings(); }
    if (tab === "leads") fetchLeads();
    if (tab === "payment") fetchPaymentSettings();
    if (tab === "about") fetchAboutContent();
  }, [tab, authorized, fetchBookings, fetchSlots, fetchLeads, fetchTemplates, fetchPaymentSettings, fetchAboutContent]);

  async function savePaymentSettings() {
    if (!paymentSettings) return;
    setSavingPayment(true);
    setPaymentSaveResult(null);
    const res = await fetch("/api/admin/payment-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentSettings),
    });
    setSavingPayment(false);
    setPaymentSaveResult(res.ok ? "ذخیره شد ✓" : "خطا در ذخیره‌سازی");
    if (res.ok) fetchPaymentSettings();
  }

  async function saveAboutContent() {
    if (!aboutContent) return;
    setSavingAbout(true);
    setAboutSaveResult(null);
    const res = await fetch("/api/admin/about-content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: aboutContent.bio, resume_items: aboutContent.resume_items }),
    });
    setSavingAbout(false);
    setAboutSaveResult(res.ok ? "ذخیره شد ✓" : "خطا در ذخیره‌سازی");
    if (res.ok) fetchAboutContent();
  }

  async function uploadAboutPhoto(file: File) {
    setUploadingPhoto(true);
    setPhotoUploadResult(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/about-content/photo", { method: "POST", body: form });
    const data = await res.json();
    setUploadingPhoto(false);
    setPhotoUploadResult(res.ok ? "عکس آپلود شد ✓" : (data.error ?? "خطا در آپلود عکس"));
    if (res.ok) fetchAboutContent();
  }

  // ── Booking edit ─────────────────────────────────────────────────────────

  async function saveBooking() {
    if (!editingBooking) return;
    setSavingBooking(true);
    await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingBooking.id, status: newStatus || undefined, meeting_link: newLink || undefined }),
    });
    setSavingBooking(false);
    setEditingBooking(null);
    fetchBookings();
  }

  // ── Slot management ──────────────────────────────────────────────────────

  async function addSlot() {
    if (!newSlotDate) return;
    setAddingSlot(true);
    const starts_at = new Date(`${newSlotDate}T${newSlotTime}:00+03:30`).toISOString();
    await fetch("/api/admin/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starts_at, duration_min: newSlotDuration, price_irr: newSlotPrice }),
    });
    setAddingSlot(false);
    setNewSlotDate("");
    fetchSlots();
  }

  async function deleteSlot(id: string) {
    const res = await fetch("/api/admin/slots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }));
      alert(error ?? "حذف زمان انجام نشد.");
    }
    fetchSlots();
  }

  // ── Recurring template management ───────────────────────────────────────

  async function addTemplate() {
    setAddingTemplate(true);
    await fetch("/api/admin/slot-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day_of_week: newTemplateDay,
        time_of_day: newTemplateTime,
        duration_min: newTemplateDuration,
        price_irr: newTemplatePrice,
      }),
    });
    setAddingTemplate(false);
    fetchTemplates();
  }

  async function deleteTemplate(id: string) {
    await fetch("/api/admin/slot-templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchTemplates();
  }

  async function generateSlots() {
    setGenerating(true);
    setGenerateResult(null);
    const res = await fetch("/api/admin/slots/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weeks: generateWeeks }),
    });
    const data = await res.json();
    setGenerating(false);
    setGenerateResult(res.ok ? `${data.created} زمان جدید ساخته شد.` : (data.error ?? "خطا در تولید زمان‌ها"));
    fetchSlots();
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="surface-card p-8 text-center space-y-3 max-w-sm">
          <p className="text-2xl">🚫</p>
          <p className="font-medium text-ink">دسترسی محدود</p>
          <p className="text-sm text-charcoal/70">این صفحه فقط برای ادمین در دسترس است.</p>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      <section className="container-content py-10">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display text-ink mb-2">پنل ادمین</h1>
            <p className="text-sm text-charcoal/60">مدیریت رزروها، زمان‌ها و لیدها</p>
          </div>
          <a
            href="/fa/admin/chatbot"
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2.5"
          >
            <span>🤖</span>
            <span>پنل مدیریت چت‌بات</span>
          </a>
        </div>
      </section>

      {/* Tab bar */}
      <section className="container-content pb-2">
        <div className="flex gap-2 border-b border-sand/40">
          {[
            { key: "bookings", label: `رزروها (${bookings.length})` },
            { key: "slots",    label: "زمان‌های قابل رزرو" },
            { key: "leads",    label: `لیدها (${leads.length})` },
            { key: "payment",  label: "پرداخت و قیمت" },
            { key: "about",    label: "درباره من" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? "border-ink text-ink"
                  : "border-transparent text-charcoal/50 hover:text-charcoal"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="container-content py-6 pb-20">

        {/* ── BOOKINGS TAB ───────────────────────────────────────────── */}
        {tab === "bookings" && (
          <div className="space-y-4">
            {bookingsLoading ? (
              <div className="flex justify-center py-10">
                <div className="h-7 w-7 border-2 border-ink border-t-transparent rounded-full animate-spin" />
              </div>
            ) : bookings.length === 0 ? (
              <p className="text-charcoal/60 text-center py-10">هیچ رزروی وجود ندارد.</p>
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="surface-card p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <p className="font-medium text-ink">{b.full_name}</p>
                      <p className="text-sm text-charcoal/70" dir="ltr">{b.email}</p>
                      {b.phone && <p className="text-sm text-charcoal/60" dir="ltr">{b.phone}</p>}
                      {b.time_slots && (
                        <p className="text-sm text-charcoal/60">{fmt(b.time_slots.starts_at)}</p>
                      )}
                      {b.meeting_link && (
                        <a href={b.meeting_link} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-gold underline" dir="ltr">
                          {b.meeting_link}
                        </a>
                      )}
                      {b.notes && (
                        <p className="text-xs text-charcoal/50 bg-sand/20 rounded px-2 py-1 mt-1">{b.notes}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLOR[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                      <button
                        onClick={() => { setEditingBooking(b); setNewStatus(b.status); setNewLink(b.meeting_link ?? ""); }}
                        className="text-xs btn-ghost !px-3 !py-1"
                      >
                        ویرایش
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-charcoal/30 font-mono" dir="ltr">ID: {b.id.slice(0, 8)}…</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── SLOTS TAB ──────────────────────────────────────────────── */}
        {tab === "slots" && (
          <div className="space-y-6">
            {/* Recurring weekly templates */}
            <div className="surface-card p-5 space-y-4">
              <div>
                <h2 className="font-medium text-ink">الگوی هفتگی تکرارشونده</h2>
                <p className="text-xs text-charcoal/50 mt-1">
                  روز و ساعتی که هرهفته می‌خوای در دسترس باشی رو یک‌بار تعریف کن، بعد با دکمه «تولید» زمان‌های واقعی چند هفته آینده ساخته می‌شن.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="min-w-[140px]">
                  <label className="block text-xs text-charcoal/60 mb-1">روز هفته</label>
                  <select
                    value={newTemplateDay}
                    onChange={(e) => setNewTemplateDay(Number(e.target.value))}
                    className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <label className="block text-xs text-charcoal/60 mb-1">ساعت</label>
                  <input
                    type="time"
                    value={newTemplateTime}
                    onChange={(e) => setNewTemplateTime(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-charcoal/60 mb-1">مدت (دقیقه)</label>
                  <input
                    type="number"
                    min={5}
                    value={newTemplateDuration}
                    onChange={(e) => setNewTemplateDuration(Number(e.target.value))}
                    dir="ltr"
                    className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs text-charcoal/60 mb-1">قیمت (تومان)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={newTemplatePrice / 10}
                    onChange={(e) => setNewTemplatePrice(Number(e.target.value) * 10)}
                    dir="ltr"
                    className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={addTemplate}
                    disabled={addingTemplate}
                    className="btn-secondary disabled:opacity-50"
                  >
                    {addingTemplate ? "..." : "افزودن به الگو"}
                  </button>
                </div>
              </div>

              {templatesLoading ? (
                <div className="flex justify-center py-4">
                  <div className="h-6 w-6 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                </div>
              ) : templates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-2 rounded-full bg-sand/30 px-3 py-1.5 text-xs text-ink">
                      {dayLabel(t.day_of_week)} · {t.time_of_day}
                      <button onClick={() => deleteTemplate(t.id)} className="text-red-500 hover:text-red-700">✕</button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-sand/40">
                <div className="w-28">
                  <label className="block text-xs text-charcoal/60 mb-1">تعداد هفته</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={generateWeeks}
                    onChange={(e) => setGenerateWeeks(Number(e.target.value))}
                    dir="ltr"
                    className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
                <button
                  onClick={generateSlots}
                  disabled={generating || templates.length === 0}
                  className="btn-primary disabled:opacity-50"
                >
                  {generating ? "در حال تولید..." : "تولید زمان‌های آینده از الگو"}
                </button>
                {generateResult && <p className="text-xs text-charcoal/60">{generateResult}</p>}
              </div>
            </div>

            {/* Add slot form */}
            <div className="surface-card p-5 space-y-4">
              <h2 className="font-medium text-ink">افزودن زمان جدید</h2>
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs text-charcoal/60 mb-1">تاریخ (میلادی)</label>
                  <input
                    type="date"
                    value={newSlotDate}
                    onChange={(e) => setNewSlotDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    dir="ltr"
                    className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs text-charcoal/60 mb-1">ساعت</label>
                  <input
                    type="time"
                    value={newSlotTime}
                    onChange={(e) => setNewSlotTime(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-charcoal/60 mb-1">مدت (دقیقه)</label>
                  <input
                    type="number"
                    min={5}
                    value={newSlotDuration}
                    onChange={(e) => setNewSlotDuration(Number(e.target.value))}
                    dir="ltr"
                    className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs text-charcoal/60 mb-1">قیمت (تومان)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={newSlotPrice / 10}
                    onChange={(e) => setNewSlotPrice(Number(e.target.value) * 10)}
                    dir="ltr"
                    className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={addSlot}
                    disabled={addingSlot || !newSlotDate}
                    className="btn-primary disabled:opacity-50"
                  >
                    {addingSlot ? "..." : "افزودن"}
                  </button>
                </div>
              </div>
              <p className="text-xs text-charcoal/40">ساعت بر اساس زمان تهران (UTC+3:30) ثبت می‌شود.</p>
            </div>

            {/* Slot list */}
            {slotsLoading ? (
              <div className="flex justify-center py-6">
                <div className="h-7 w-7 border-2 border-ink border-t-transparent rounded-full animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-charcoal/60 text-center py-6">هیچ زمانی تعریف نشده.</p>
            ) : (
              <div className="space-y-3">
                {slots.map((s) => (
                  <div key={s.id} className="surface-card p-4 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="font-medium text-ink text-sm">{fmt(s.starts_at)}</p>
                      <p className="text-xs text-charcoal/50">{s.duration_min} دقیقه · {((s.price_irr ?? 5000000) / 10).toLocaleString("fa-IR")} تومان</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.available ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {s.available ? "آزاد" : "رزرو شده"}
                      </span>
                      {s.available && (
                        <button
                          onClick={() => deleteSlot(s.id)}
                          className="text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── LEADS TAB ──────────────────────────────────────────────── */}
        {tab === "leads" && (
          <div className="space-y-4">
            {leadsLoading ? (
              <div className="flex justify-center py-10">
                <div className="h-7 w-7 border-2 border-ink border-t-transparent rounded-full animate-spin" />
              </div>
            ) : leads.length === 0 ? (
              <p className="text-charcoal/60 text-center py-10">هیچ لیدی ثبت نشده.</p>
            ) : (
              leads.map((l) => (
                <div key={l.id} className="surface-card p-4 space-y-2">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="space-y-1">
                      {l.name && <p className="font-medium text-ink">{l.name}</p>}
                      {l.phone && <p className="text-sm text-charcoal/70" dir="ltr">{l.phone}</p>}
                      {l.email && <p className="text-sm text-charcoal/70" dir="ltr">{l.email}</p>}
                      {l.interest && <p className="text-xs text-charcoal/50">{l.interest}</p>}
                    </div>
                    <span className="text-xs text-charcoal/40">{fmt(l.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── PAYMENT SETTINGS TAB ───────────────────────────────────── */}
        {tab === "payment" && (
          <div className="space-y-6 max-w-2xl">
            {paymentLoading || !paymentSettings ? (
              <div className="flex justify-center py-10">
                <div className="h-7 w-7 border-2 border-ink border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="surface-card p-5 space-y-4">
                  <h2 className="font-medium text-ink">قیمت و مدت مشاوره</h2>
                  <div className="flex flex-wrap gap-3">
                    <div className="w-32">
                      <label className="block text-xs text-charcoal/60 mb-1">مدت (دقیقه)</label>
                      <input
                        type="number" min={5} dir="ltr"
                        value={paymentSettings.consultation_duration_min}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, consultation_duration_min: Number(e.target.value) })}
                        className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                      />
                    </div>
                    <div className="w-40">
                      <label className="block text-xs text-charcoal/60 mb-1">قیمت (تومان)</label>
                      <input
                        type="number" min={0} step={1000} dir="ltr"
                        value={paymentSettings.consultation_price_irr / 10}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, consultation_price_irr: Number(e.target.value) * 10 })}
                        className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                      />
                    </div>
                    <div className="w-40">
                      <label className="block text-xs text-charcoal/60 mb-1">قیمت (دلار، برای کاربران انگلیسی)</label>
                      <input
                        type="number" min={0} step={1} dir="ltr"
                        value={paymentSettings.consultation_price_usd ?? ""}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, consultation_price_usd: e.target.value === "" ? null : Number(e.target.value) })}
                        placeholder="مثلاً 15"
                        className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-charcoal/40">این مقادیر پیش‌فرض هستند — هر زمان/الگوی مجزا هم می‌تواند قیمت خودش را در تب «زمان‌های قابل رزرو» داشته باشد.</p>
                </div>

                <div className="surface-card p-5 space-y-4">
                  <h2 className="font-medium text-ink">حساب بانکی ایران (برای کاربران فارسی‌زبان)</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-charcoal/60 mb-1">نام بانک</label>
                      <input
                        value={paymentSettings.irr_bank_name ?? ""}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, irr_bank_name: e.target.value })}
                        placeholder="مثلاً بانک ملت"
                        className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-charcoal/60 mb-1">شماره کارت</label>
                      <input
                        value={paymentSettings.irr_card_number ?? ""}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, irr_card_number: e.target.value })}
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        dir="ltr"
                        className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-charcoal/60 mb-1">به نام</label>
                      <input
                        value={paymentSettings.irr_account_holder ?? ""}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, irr_account_holder: e.target.value })}
                        placeholder="نام صاحب حساب"
                        className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                      />
                    </div>
                  </div>
                </div>

                <div className="surface-card p-5 space-y-4">
                  <h2 className="font-medium text-ink">کارت بین‌المللی (برای کاربران انگلیسی‌زبان)</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-charcoal/60 mb-1">نوع کارت</label>
                      <input
                        value={paymentSettings.intl_card_brand ?? ""}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, intl_card_brand: e.target.value })}
                        placeholder="Visa"
                        dir="ltr"
                        className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-charcoal/60 mb-1">شماره کارت</label>
                      <input
                        value={paymentSettings.intl_card_number ?? ""}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, intl_card_number: e.target.value })}
                        placeholder="XXXX XXXX XXXX XXXX"
                        dir="ltr"
                        className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-charcoal/60 mb-1">Account holder</label>
                      <input
                        value={paymentSettings.intl_account_holder ?? ""}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, intl_account_holder: e.target.value })}
                        placeholder="Account holder name"
                        dir="ltr"
                        className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-charcoal/40">
                    اگه این بخش خالی بماند، صفحه‌ی رزرو انگلیسی به‌جای کارت جعلی، پیام «برای هماهنگی پرداخت با ما تماس بگیرید» نشان می‌دهد.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={savePaymentSettings} disabled={savingPayment} className="btn-primary disabled:opacity-50">
                    {savingPayment ? "..." : "ذخیره تنظیمات پرداخت"}
                  </button>
                  {paymentSaveResult && <p className="text-xs text-charcoal/60">{paymentSaveResult}</p>}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ABOUT PAGE CONTENT TAB ─────────────────────────────────── */}
        {tab === "about" && (
          <div className="space-y-6 max-w-2xl">
            {aboutLoading || !aboutContent ? (
              <div className="flex justify-center py-10">
                <div className="h-7 w-7 border-2 border-ink border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="surface-card p-5 space-y-4">
                  <h2 className="font-medium text-ink">عکس پروفایل</h2>
                  <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={aboutContent.photo_url || "/images/about/founder.jpeg"}
                      alt="پیش‌نمایش عکس"
                      className="h-24 w-24 rounded-xl object-cover object-top border border-sand"
                    />
                    <div className="space-y-2">
                      <label className="btn-secondary cursor-pointer inline-block">
                        {uploadingPhoto ? "در حال آپلود..." : "آپلود عکس جدید"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={uploadingPhoto}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadAboutPhoto(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {photoUploadResult && <p className="text-xs text-charcoal/60">{photoUploadResult}</p>}
                    </div>
                  </div>
                  <p className="text-xs text-charcoal/40">فرمت JPG، PNG یا WebP، حداکثر ۸ مگابایت.</p>
                </div>

                <div className="surface-card p-5 space-y-4">
                  <h2 className="font-medium text-ink">داستان و معرفی</h2>
                  <textarea
                    value={aboutContent.bio ?? ""}
                    onChange={(e) => setAboutContent({ ...aboutContent, bio: e.target.value })}
                    rows={6}
                    placeholder="هر پاراگراف رو در یک خط جدید بنویس..."
                    className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>

                <div className="surface-card p-5 space-y-4">
                  <h2 className="font-medium text-ink">رزومه و مسیر تخصصی</h2>
                  <textarea
                    value={aboutContent.resume_items ?? ""}
                    onChange={(e) => setAboutContent({ ...aboutContent, resume_items: e.target.value })}
                    rows={6}
                    placeholder="هر مورد (گواهینامه، سابقه، ...) رو در یک خط جدید بنویس..."
                    className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
                  />
                  <p className="text-xs text-charcoal/40">هر خط به‌صورت یک مورد جدا در صفحه «درباره من» نمایش داده می‌شود.</p>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={saveAboutContent} disabled={savingAbout} className="btn-primary disabled:opacity-50">
                    {savingAbout ? "..." : "ذخیره"}
                  </button>
                  {aboutSaveResult && <p className="text-xs text-charcoal/60">{aboutSaveResult}</p>}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* Edit booking modal */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="surface-card w-full max-w-sm p-6 space-y-4">
            <h3 className="font-medium text-ink">ویرایش رزرو</h3>
            <p className="text-sm text-charcoal/60">{editingBooking.full_name}</p>

            <div>
              <label className="block text-xs text-charcoal/60 mb-1">وضعیت</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none"
              >
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-charcoal/60 mb-1">لینک جلسه (اختیاری)</label>
              <input
                type="url"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                dir="ltr"
                className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/40"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditingBooking(null)} className="btn-secondary flex-1">انصراف</button>
              <button onClick={saveBooking} disabled={savingBooking} className="btn-primary flex-1 disabled:opacity-60">
                {savingBooking ? "..." : "ذخیره"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
