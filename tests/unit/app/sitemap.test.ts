/**
 * @jest-environment node
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { CANONICAL_ORIGIN, PUBLIC_PAGES } from "@/lib/site";

const APP = path.join(process.cwd(), "src/app");

// Route groups like (app) and (marketing) don't appear in the URL, so a page
// for `/guide` can live in any of them.
const pageExists = (route: string): boolean => {
  const groups = readdirSync(APP).filter((dir) => /^\(.+\)$/.test(dir));
  return ["", ...groups].some((group) =>
    existsSync(path.join(APP, group, route, "page.tsx")),
  );
};

describe("sitemap", () => {
  // A sitemap entry that 404s is a dead link handed straight to search engines.
  it.each(PUBLIC_PAGES)("lists %s, which has a page", (route) => {
    expect(pageExists(route)).toBe(true);
  });

  it("gives search engines the canonical host, not the redirecting apex", () => {
    for (const { url } of sitemap()) {
      expect(url.startsWith(CANONICAL_ORIGIN)).toBe(true);
    }
  });

  // Listing a page and telling crawlers to stay out of it contradicts itself.
  it("lists nothing that robots.txt disallows", () => {
    const rules = robots().rules;
    const disallowed = (Array.isArray(rules) ? rules : [rules]).flatMap((r) =>
      r.disallow === undefined ? [] : [r.disallow].flat(),
    );

    for (const route of PUBLIC_PAGES) {
      expect(disallowed.some((prefix) => route.startsWith(prefix))).toBe(false);
    }
  });
});
