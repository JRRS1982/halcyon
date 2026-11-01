import type { MetadataRoute } from "next";
import { FEATURES } from "@/lib/editorial/features";
import { CANONICAL_ORIGIN, PUBLIC_PAGES } from "@/lib/site";

// No lastModified: these pages carry no edit date, and a build timestamp
// would claim every page changed on every deploy.
export default function sitemap(): MetadataRoute.Sitemap {
  // Each feature article is one template page, listed from the articles
  // themselves so a new article is in the sitemap the moment it exists.
  const articles = FEATURES.map((article) => `/features/${article.slug}`);
  return [...PUBLIC_PAGES, ...articles].map((path) => ({
    url: path === "/" ? CANONICAL_ORIGIN : `${CANONICAL_ORIGIN}${path}`,
  }));
}
