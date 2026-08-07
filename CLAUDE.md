# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node.js lives at a non-standard path (portable install, no admin rights). **Use cmd (not PowerShell)** — PowerShell has execution-policy issues with npm scripts and doesn't support `&&`.

Prefix every cmd session with:

```cmd
set "Path=%LOCALAPPDATA%\nodejs-portable\node-v22.11.0-win-x64;%Path%"
cd "C:\Users\ASUS\OneDrive\Desktop\beur"
```

| Task | Command |
|---|---|
| Dev server | `npx next dev` → http://localhost:3000 |
| Production build | `npm run build` |
| Clear cache & restart | `rmdir /s /q .next` then `npx next dev` |
| Deploy to production | `npx vercel --prod --yes` (project already linked via `.vercel/project.json`) |

There are no automated tests in this project. `eslint`/`eslint-config-next` are not installed, and `next.config.mjs` sets `eslint.ignoreDuringBuilds: true` — without it, `next build`/`next lint` prompt interactively to set up ESLint on first run, which hangs forever in a non-interactive shell. Don't remove that flag without installing eslint + eslint-config-next first.

This machine is memory-constrained (~4 GB RAM) — `npm run build` and bare `tsc --noEmit` can take a very long time or OOM. When possible, prefer deploying (`npx vercel --prod`) to validate a change over waiting out a local build, since the Vercel build runs on unconstrained infra.

The project directory lives inside OneDrive sync, so `next.config.mjs` forces webpack polling (`watchOptions.poll`) in dev — native filesystem watch events are unreliable under OneDrive and hot reload silently stops working without it.

## Architecture

**Next.js 14 App Router** with `next-intl` for bilingual routing. Every page lives under `src/app/[locale]/` and is statically pre-rendered for both locales (`fa` = Persian/RTL, `en` = English/LTR).

### Routing & i18n

- `src/middleware.ts` — intercepts all non-asset requests, redirects/rewrites to the correct locale prefix, **and** refreshes the Supabase auth session (`supabase.auth.getUser()`) on every matched request so cookies stay valid across navigations.
- `src/i18n/routing.ts` — defines `locales: ["fa", "en"]`, `defaultLocale: "fa"`.
- `messages/fa.json` and `messages/en.json` — **single source of all UI strings**. Every page uses `useTranslations` / `getTranslations`; no hardcoded copy anywhere.
- The root layout (`src/app/[locale]/layout.tsx`) sets `<html lang dir>` — `dir="rtl"` for `fa`, `dir="ltr"` for `en`. Tailwind's `rtl:` / `ltr:` variants handle directional overrides.
- All new pages must call `setRequestLocale(locale)` at the top for static rendering compatibility.

### Styling system

- Page background: Dark Gold (`#b29560` via CSS `--bg`).
- Brand palette tokens in `tailwind.config.ts`: `ink` (black), `charcoal`, `gold-dark`, `gold`, `sand`, `paper`.
- Reusable utility classes in `globals.css`: `.container-content`, `.label-eyebrow`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.surface-card` (sand bg), `.surface-dark` (ink bg), `.link-accent`.
- Fonts: **Vazirmatn** (`--font-vazir`) for body/Persian, **Cormorant Garamond** (`--font-cormorant`) for display/Latin headings — both loaded via `next/font/google` in the root layout.
- Logo: `LogoMark` always renders with `bg-ink` + `text-gold`. No tone-based switching.

### Component conventions

- `src/components/` — shared UI: `Logo`, `Navbar`, `Footer`, `LanguageSwitcher`, `ColorChatbot`.
- `src/components/sections/` — full-width page sections.
- Pages in `src/app/[locale]/` compose sections and stay thin (no business logic).

### Supabase

Three clients — always pick the right one:

| Client | File | Use when |
|---|---|---|
| Browser | `src/lib/supabase/client.ts` | Client components, respects RLS |
| Server (cookies) | `src/lib/supabase/server.ts` | Server components / route handlers with user session |
| Service (admin) | `src/lib/supabase/service.ts` | Route handlers that must bypass RLS (admin ops, role checks) |

Admin role check pattern: client fetches `/api/me` with `Authorization: Bearer <access_token>` header; the route uses the service client to read `profiles.role` and bypasses RLS cookie issues.

`supabase/fix_rls_security_advisor.sql` enables RLS (with no policies) on tables that are only ever touched via the service-role client — e.g. the chatbot's `documents`, `chunks`, `conversations`, `messages`, `admin_users`. Safe no-op for app behavior (service role always bypasses RLS); it only closes off anon/authenticated direct access that Supabase's Security Advisor flags.

### Auth (implemented)

- `src/app/[locale]/auth/` — login, register, reset-password pages (each has a `*Client.tsx` for the form logic).
- `src/app/auth/callback/route.ts` — handles Supabase OAuth / magic-link redirects.
- Auth state is read client-side via `supabase.auth.getUser()` / `getSession()`.

### Booking system (implemented)

- `src/app/[locale]/booking/` — booking page + `BookingClient.tsx`. Step 1 renders a navigable weekly calendar (7-day grid, prev/next week) built from `time-slots`, grouped by Tehran-local date via `useMemo`.
- `src/app/api/time-slots/route.ts` — GET available slots (`available=true`, future only, `.limit(500)`).
- `src/app/api/bookings/route.ts` and `[id]/route.ts` — POST to create, PATCH/GET by ID.
- Slots timezone: Tehran (UTC+3:30, no DST) — always handled either via manual `+03:30` ISO suffix or `Intl`/`toLocaleString` `timeZone: "Asia/Tehran"`, never a raw local-time assumption.
- **Recurring weekly slot templates**: instead of creating every slot by hand, admin defines a weekly pattern (day of week + time) once in the "الگوی هفتگی تکرارشونده" block of the slots tab.
  - `supabase/recurring_slots.sql` — `recurring_slot_templates` table (`day_of_week` 0–6, `time_of_day` "HH:MM", `duration_min`, `price_irr`, `service`, `active`), admin-only RLS.
  - `src/app/api/admin/slot-templates/route.ts` — GET/POST/DELETE CRUD for templates.
  - `src/app/api/admin/slots/generate/route.ts` — POST; for each active template, projects real `time_slots` rows N weeks ahead (1–12, default 4), skipping past timestamps and de-duping against existing slots. This is a manual "generate" button, not a cron — the admin re-clicks it periodically to top up the window.
- **Payment (manual bank transfer, pre-Stripe/Zarinpal)**: a singleton `payment_settings` row (`supabase/payment_settings.sql`, id always `1`) holds consultation price/duration plus IRR bank-card and international-card details, admin-editable. No fabricated defaults — card fields are `null` until an admin fills them in.
  - `src/app/api/payment-settings/route.ts` — public GET (`force-dynamic`, since it has no cookies/headers to make Next.js treat it as dynamic otherwise); the booking page's payment step reads this to show transfer instructions to any visitor.
  - `src/app/api/admin/payment-settings/route.ts` — GET/PUT, admin-only (same `profiles.role === "admin"` check pattern as other admin routes).

### Admin panel

- `src/app/[locale]/admin/page.tsx` + `AdminClient.tsx` — four tabs: **رزروها** (bookings), **زمان‌های قابل رزرو** (slots + recurring templates), **لیدها** (chatbot leads), **پرداخت و قیمت** (payment settings).
- `src/app/[locale]/admin/chatbot/` — dedicated chatbot admin panel (`ChatbotAdminClient.tsx`).
- Admin API routes under `src/app/api/admin/`: `bookings`, `slots` (+ `slot-templates`, `slots/generate`), `leads`, `payment-settings`, and `chatbot/*` (stats, documents, config, prompt, conversations, feedback, broadcast, playground).
- Access guard: `AdminClient` checks `/api/me` on mount; redirects to login if unauthenticated, shows 403 if role ≠ `"admin"`.

### AI Color Analysis

Free 4-season personal color analysis. No login required.

- **Page**: `src/app/[locale]/color-analysis/` — server page + `ColorAnalysisClient.tsx`.
- **Demo section**: `src/components/sections/ColorAnalysisDemo.tsx` — animated homepage section.
- **API**: `src/app/api/analyze-colors/route.ts` — POST `{imageBase64, mimeType}` → `{analysis, provider}`.
  - Provider chain: Claude Sonnet 4.6 → OpenRouter free vision models → MOCK_RESULT.
  - Image compressed client-side (Canvas, max 900px, JPEG 0.82).
- Result shape: season + undertone + skinTone + hairColors + eyebrowColors + makeup + avoidColors. Every field has English + Persian variants.

### Chatbot system ("One Brain, Multiple Channels")

All chatbot generation goes through **OpenRouter** (OpenAI-compatible API). The brain (`src/lib/chatbot/brain.ts`) is the single entry point for all surfaces.

#### Brain flow

1. Loads model config from `model_config` DB table (per-channel, 60s cache). Supports day/time schedule overrides for model swaps.
2. Loads system prompt from `prompt_versions` DB table (active version, 60s cache).
3. Runs RAG retrieval (`src/lib/chatbot/rag.ts`): embeds query → `match_chunks` RPC → fallback to `match_documents` → fallback to full-scan.
4. Loads session history (last 20 turns) + long-term memory from `chat_sessions` / `chat_memory` tables.
5. Calls OpenRouter with tool use (OpenAI format). Falls back to `fallback_model` on error.
6. Executes tool calls (`src/lib/chatbot/tools.ts`): `capture_lead`, `check_enrollment_status`, `handoff_to_human`.
7. Persists updated session and logs to `conversations` / `messages` tables.

Streaming variant (`streamMessage`) proxies OpenRouter SSE directly to the client.

#### Surfaces

| Surface | File | Notes |
|---|---|---|
| Web floating widget | `src/components/ColorChatbot.tsx` | Injected in root layout; streams via `/api/chatbot/stream` |
| Web chat page | `src/app/[locale]/chat/` | Full-page chat (`ChatClient.tsx`) |
| Telegram bot | `src/app/api/telegram/route.ts` | Webhook handler; rate-limited 10 msg/min; syncs users to `unified_users` |
| Embeddable widget | `src/app/api/widget/route.ts` | — |

#### RAG pipeline

- `src/lib/chatbot/embeddings.ts` — generates embeddings (config from `embedding_config` DB table).
- `src/lib/chatbot/ingestion.ts` — document ingestion into `chunks` table.
- `src/app/api/chatbot/ingest/route.ts` — trigger ingestion from admin panel.
- Primary: `chunks` table with `match_chunks` RPC. Legacy fallback: `chatbot_documents` with `match_documents` RPC → final fallback: full-scan of `chatbot_documents`.
- **Seeded knowledge**: 18-section 12-season color analysis KB is in `chatbot_documents` (metadata `seed: "color-kb-v1"`). Inserted without embeddings — only available via full-scan fallback until a `COHERE_API_KEY` (or other embedding provider) is added and documents are re-ingested through `src/app/api/chatbot/ingest/route.ts`.

### SEO / discoverability

- `src/app/sitemap.ts` and `src/app/robots.ts` — Next.js `MetadataRoute` files, generated at `/sitemap.xml` and `/robots.txt`. Sitemap lists public marketing paths for both locales; robots disallows `/api/`, `/admin`, `/dashboard`, `/auth/`.
- `generateMetadata` in `src/app/[locale]/layout.tsx` sets `metadataBase`, a default `alternates.canonical`/`languages` (fa/en hreflang), and Google Search Console `verification.google`. That layout-level canonical always resolves to `/${locale}` (the homepage) since the layout has no visibility into the child route's path — it is only correct for the locale root.
- Every other public page (`about`, `services`, `services/consultation`, `color-analysis`, `booking`) **must** export its own `generateMetadata` that calls `pageAlternates(locale, path)` from `src/lib/seo.ts` to set a self-referencing canonical, plus a page-specific title/description. Skipping this makes Google Search Console flag the page as "Duplicate without user-selected canonical" and refuse to index it (all subpages silently inherited the homepage's canonical until this was fixed) — copy the pattern from an existing page rather than relying on the layout default.
- All of the above read `NEXT_PUBLIC_SITE_URL`, falling back to `https://beur.vercel.app` if unset.

### Deployment (Vercel)

- Project is linked via `.vercel/project.json` — org `nima-mohsenzadeh-s-projects`, project `beur`. Live at **https://beur.vercel.app**.
- Custom domain `beurseason.com` (+ `www`) is added to the Vercel project (`vercel domains add`) but DNS is not yet pointed at Vercel — the registrar (GoDaddy) / DNS host (HostGator) still need the Vercel `A` records added by whoever controls that account. Until then, treat `beur.vercel.app` as the canonical live URL.
- `.env.local` is **local-only** and is not synced to Vercel automatically. Production env vars must be set separately (`npx vercel env add <NAME> production` or the Vercel dashboard) — a missing prod var fails the build at prerender time with an opaque error (e.g. `@supabase/ssr: Your project's URL and API key are required`), not a clear "env var missing" message.
- `NEXT_PUBLIC_*` vars are inlined at **build time**; changing one on Vercel requires a fresh deploy to take effect, not just a dashboard edit. They also default to Vercel's "Sensitive" mode on Production/Preview, which makes them write-only (`vercel env pull` / dashboard can't read the value back) — a successful build is the only reliable way to confirm one saved correctly. To overwrite one non-interactively: `vercel env add <NAME> production --value <v> --force --yes`.
- Pushing to `origin/master` (GitHub) and running `npx vercel --prod` are both valid deploy paths; keep them in sync.

### Environment variables

`.env.local` — required:

```
ANTHROPIC_API_KEY=sk-ant-...            # Color analysis (Claude Sonnet vision)
OPENROUTER_API_KEY=sk-or-v1-...        # Chatbot brain (all surfaces) + color analysis fallback
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # Service client (admin ops, bypasses RLS)
TELEGRAM_BOT_TOKEN=...                 # Telegram webhook
TELEGRAM_WEBHOOK_SECRET=...            # Telegram webhook signature check
NEXT_PUBLIC_SITE_URL=...               # Canonical site URL for sitemap/robots/metadata (optional, defaults to beur.vercel.app)
```

Future phases require: `STRIPE_SECRET_KEY`, `ZARINPAL_MERCHANT_ID`.

### Planned phases

- **Phase 4** — Dual payment: Stripe (international) + Zarinpal (Iran).
- **Phase 5** — Email confirmations, polish. (SEO basics — sitemap/robots/hreflang/Search Console — already in place.)
