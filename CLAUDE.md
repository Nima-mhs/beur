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
| Type-check / lint | `npm run lint` |
| Clear cache & restart | `rmdir /s /q .next` then `npx next dev` |

There are no automated tests in this project.

## Architecture

**Next.js 14 App Router** with `next-intl` for bilingual routing. Every page lives under `src/app/[locale]/` and is statically pre-rendered for both locales (`fa` = Persian/RTL, `en` = English/LTR).

### Routing & i18n

- `src/middleware.ts` — intercepts all non-asset requests, redirects/rewrites to the correct locale prefix.
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

### Auth (implemented)

- `src/app/[locale]/auth/` — login, register, reset-password pages (each has a `*Client.tsx` for the form logic).
- `src/app/auth/callback/route.ts` — handles Supabase OAuth / magic-link redirects.
- Auth state is read client-side via `supabase.auth.getUser()` / `getSession()`.

### Booking system (implemented)

- `src/app/[locale]/booking/` — booking page + `BookingClient.tsx`.
- `src/app/api/time-slots/route.ts` — GET available slots.
- `src/app/api/bookings/route.ts` and `[id]/route.ts` — POST to create, PATCH/GET by ID.
- Slots timezone: Tehran (UTC+3:30) — slot creation in AdminClient converts local date+time to ISO before saving.

### Admin panel

- `src/app/[locale]/admin/page.tsx` + `AdminClient.tsx` — three tabs: **رزروها** (bookings), **زمان‌ها** (slots), **لیدها** (chatbot leads).
- `src/app/[locale]/admin/chatbot/` — dedicated chatbot admin panel (`ChatbotAdminClient.tsx`).
- Admin API routes under `src/app/api/admin/`: `bookings`, `slots`, `leads`, and `chatbot/*` (stats, documents, config, prompt, conversations, feedback, broadcast, playground).
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

### Environment variables

`.env.local` — required:

```
ANTHROPIC_API_KEY=sk-ant-...            # Color analysis (Claude Sonnet vision)
OPENROUTER_API_KEY=sk-or-v1-...        # Chatbot brain (all surfaces) + color analysis fallback
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # Service client (admin ops, bypasses RLS)
TELEGRAM_BOT_TOKEN=...                 # Telegram webhook
```

Future phases require: `STRIPE_SECRET_KEY`, `ZARINPAL_MERCHANT_ID`.

### Planned phases

- **Phase 4** — Dual payment: Stripe (international) + Zarinpal (Iran).
- **Phase 5** — Email confirmations, SEO, polish.
