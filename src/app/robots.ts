import type { MetadataRoute } from "next";
import { CANONICAL_ORIGIN } from "@/lib/site";

// Crawl hints, not access control: every path below is already behind a
// session, a one-time token or a redirect. Listing them saves crawlers from
// fetching pages that would only bounce them to /sign-in.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard",
        "/budget",
        "/balance",
        "/plan",
        "/transactions",
        "/settings",
        "/forgot-password",
        "/reset-password",
        "/unsubscribe",
      ],
    },
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
  };
}
