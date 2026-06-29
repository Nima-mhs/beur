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

// ── Component ──────────────────────────────────────────────────────────────

export function AdminClient() {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<"bookings" | "slots" | "leads">("bookings");
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
  const [addingSlot, setAddingSlot] = useState(false);

  // Leads state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

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

  useEffect(() => {
    if (!authorized) return;
    if (tab === "bookings") fetchBookings();
    if (tab === "slots") fetchSlots();
    if (tab === "leads") fetchLeads();
  }, [tab, authorized, fetchBookings, fetchSlots, fetchLeads]);

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
      body: JSON.stringify({ starts_at }),
    });
    setAddingSlot(false);
    setNewSlotDate("");
    fetchSlots();
  }

  async function deleteSlot(id: string) {
    await fetch("/api/admin/slots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
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
                      <p className="text-xs text-charcoal/50">{s.duration_min} دقیقه · {((s.price_irr ?? 5000000) / 10000).toLocaleString("fa-IR")} تومان</p>
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
