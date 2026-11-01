import { existsSync } from "node:fs";
import path from "node:path";
import { FEATURES, featureBySlug } from "@/lib/editorial/features";

const PUBLIC = path.join(__dirname, "../../../../public");

// The public feature articles. If a picture is missing the page shows a broken
// image to a prospect; if two articles share a slug one of them can't be
// reached.
describe("feature articles", () => {
  test("every picture exists", () => {
    const pictures = FEATURES.flatMap((article) => [
      article.picture,
      ...article.sections.flatMap((s) => (s.picture ? [s.picture] : [])),
    ]);
    for (const picture of pictures) {
      expect(existsSync(path.join(PUBLIC, picture.src))).toBe(true);
    }
  });

  test("slugs are unique and each one finds its article", () => {
    const slugs = FEATURES.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(featureBySlug(slug)?.slug).toBe(slug);
    }
    expect(featureBySlug("nope")).toBeUndefined();
  });

  // Names appear in navigation and links, where one word is clearest.
  test("every article is named in one word", () => {
    for (const article of FEATURES) {
      expect(article.name).toMatch(/^\S+$/);
    }
  });
});
