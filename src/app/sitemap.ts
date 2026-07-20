import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://beur.vercel.app").replace(/\/$/, "");

const publicPaths = [
  "",
  "/about",
  "/services",
  "/services/consultation",
  "/color-analysis",
  "/booking",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routing.locales.flatMap((locale) =>
    publicPaths.map((path) => ({
      url: `${siteUrl}/${locale}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    }))
  );
}
