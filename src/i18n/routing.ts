import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Persian is the primary brand language; English is the secondary B2B/global one.
  locales: ["fa", "en"],
  defaultLocale: "fa",
});

export type Locale = (typeof routing.locales)[number];
