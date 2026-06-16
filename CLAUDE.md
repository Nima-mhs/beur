# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node.js lives at a non-standard path (portable install, no admin rights). **Prefix every npm/node command** with the PATH fix:

```powershell
$env:Path = "$env:LOCALAPPDATA\nodejs-portable\node-v22.11.0-win-x64;$env:Path"
```

| Task | Command |
|---|---|
| Dev server | `npm run dev` → http://localhost:3000 |
| Production build | `npm run build` |
| Type-check / lint | `npm run lint` |

There are no automated tests in this project yet.

## Architecture

**Next.js 14 App Router** with `next-intl` for bilingual routing. Every page lives under `src/app/[locale]/` and is statically pre-rendered for both locales (`fa` = Persian/RTL, `en` = English/LTR).

### Routing & i18n

- `src/middleware.ts` — intercepts all non-asset requests and redirects/rewrites to the correct locale prefix.
- `src/i18n/routing.ts` — defines `locales: ["fa", "en"]`, `defaultLocale: "fa"`.
- `src/i18n/request.ts` — loads `messages/[locale].json` per request.
- `messages/fa.json` and `messages/en.json` — **single source of all UI strings**. Every page uses `useTranslations` / `getTranslations`; no hardcoded copy anywhere.
- The root layout (`src/app/[locale]/layout.tsx`) sets `<html lang dir>` — `dir="rtl"` for `fa`, `dir="ltr"` for `en`. Tailwind's `rtl:` / `ltr:` variants handle directional overrides.

### Styling system

- Page background: Dark Gold (`#b29560` via CSS `--bg`).
- Brand palette tokens in `tailwind.config.ts`: `ink` (black), `charcoal`, `gold-dark`, `gold`, `sand`, `paper`.
- Reusable utility classes in `globals.css`: `.container-content`, `.label-eyebrow`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.surface-card` (sand bg), `.surface-dark` (ink bg), `.link-accent`.
- Fonts: **Vazirmatn** (`--font-vazir`) for body/Persian, **Cormorant Garamond** (`--font-cormorant`) for display/Latin headings — both loaded via `next/font/google` in the root layout.
- Logo: `LogoMark` always renders with `bg-ink` + `text-gold` (black circle, gold text). No tone-based switching.

### Component conventions

- `src/components/` — shared UI: `Logo`, `Navbar`, `Footer`, `LanguageSwitcher`, `ColorChatbot`.
- `src/components/sections/` — full-width page sections including `ColorAnalysisDemo` (animated homepage section).
- Pages in `src/app/[locale]/` compose sections; they stay thin (no business logic).
- All new pages must call `setRequestLocale(locale)` at the top for static rendering compatibility.

### AI Color Analysis (Phase 1 — implemented)

Free 4-season personal color analysis. No login required. Entry points:
- **Page**: `src/app/[locale]/color-analysis/` — server page + `ColorAnalysisClient.tsx` (client component)
- **Demo section**: `src/components/sections/ColorAnalysisDemo.tsx` — animated homepage section (auto-cycles 4 seasons)
- **Chatbot**: `src/components/ColorChatbot.tsx` — floating chat button, site-wide, injected in root layout

#### API routes

`src/app/api/analyze-colors/route.ts` — POST `{imageBase64, mimeType}` → `{analysis, provider}`
- Provider chain: Claude Sonnet 4.6 → OpenRouter free vision models → MOCK_RESULT (demo)
- Claude is skipped silently when credits are exhausted (`isCreditError()`)
- OpenRouter: dynamically fetches free vision models at startup; `tryParseJson()` repairs truncated responses
- Image is compressed client-side before upload (Canvas, max 900px, JPEG 0.82)

`src/app/api/chat/route.ts` — POST `{messages}` → `{message}`
- Provider chain: Claude Haiku 4.5 → OpenRouter `google/gemma-4-31b-it:free` → static fallback message

#### Analysis result shape

Season (Spring/Summer/Autumn/Winter) + undertone + skinTone + hairColors + eyebrowColors + makeup (foundation, blush, lipstick, eyeshadow) + avoidColors. Every field has both English and Persian (`nameFa`, `seasonFa`, etc.).

### Environment variables

`.env.local` — required for AI features:
```
ANTHROPIC_API_KEY=sk-ant-...        # Claude Sonnet (vision) + Haiku (chat)
OPENROUTER_API_KEY=sk-or-v1-...     # Free vision models fallback
NEXT_PUBLIC_SUPABASE_URL=...        # Auth (Phase 2)
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # Auth (Phase 2)
```

Future phases require: `STRIPE_SECRET_KEY`, `ZARINPAL_MERCHANT_ID`.

### Planned phases

- **Phase 2** — Supabase Auth (email + Google OAuth), user dashboard.
- **Phase 3** — Booking system (availability slots, calendar UI).
- **Phase 4** — Dual payment: Stripe (international) + Zarinpal (Iran).
- **Phase 5** — Email confirmations, SEO, polish.
