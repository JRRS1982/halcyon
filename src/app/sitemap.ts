import type { MetadataRoute } from "next";
import { CANONICAL_ORIGIN, PUBLIC_PAGES } from "@/lib/site";

// No lastModified: these pages carry no edit date, and a build timestamp
// would claim every page changed on every deploy.
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((path) => ({
    url: path === "/" ? CANONICAL_ORIGIN : `${CANONICAL_ORIGIN}${path}`,
  }));
}
