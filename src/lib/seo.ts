import type { Metadata } from "next";

/**
 * Per-page canonical/hreflang alternates. The root layout sets a blanket
 * `canonical: /${locale}` for every route it wraps, which is only correct
 * for the locale homepage — every other page needs its own self-referencing
 * canonical or Google treats it as a duplicate of the homepage.
 */
export function pageAlternates(locale: string, path: string): Metadata["alternates"] {
  const suffix = path === "" ? "" : path;
  return {
    canonical: `/${locale}${suffix}`,
    languages: {
      fa: `/fa${suffix}`,
      en: `/en${suffix}`,
    },
  };
}
