import { parseMarkdown } from "@/lib/design/markdown";
import { readDesignDoc, splitDesignDoc } from "@/lib/design/source";

// The guard on the real document. /design renders DESIGN.md rather than a
// transcription of it, which is the whole reason the page cannot go stale —
// and the cost of that is that a construct the reader does not cover would
// break a published page. It breaks the build here instead.

describe("DESIGN.md", () => {
  const load = async () => splitDesignDoc(await readDesignDoc());

  test("splits into a token contract and its prose", async () => {
    const { contract, prose } = await load();

    expect(contract).toContain("colors:");
    expect(contract).toContain("typography:");
    // The closing fence belongs to the contract, not the prose.
    expect(prose.trimStart().startsWith("## Overview")).toBe(true);
    expect(prose).not.toContain("\n---\n");
  });

  test("parses with no unsupported markdown", async () => {
    const { prose } = await load();

    expect(() => parseMarkdown(prose)).not.toThrow();
  });

  test("every section is reachable from the contents list", async () => {
    const { prose } = await load();
    const sections = parseMarkdown(prose).flatMap((block) =>
      block.kind === "heading" && block.level === 2 ? [block] : [],
    );
    const slugs = sections.map((section) => section.slug);

    expect(slugs).toEqual([
      "overview",
      "colors",
      "typography",
      "layout",
      "colour-schemes",
      "elevation-depth",
      "shapes",
      "components",
      "data-visualization",
      "do-s-and-don-ts",
    ]);
    // Duplicate slugs would silently point two contents entries at one anchor.
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  // The reader handles code, bold and italic inline. A link would render as
  // its literal brackets, so the document does not use them — asserted here
  // rather than left to be noticed on the published page.
  test("uses no inline links or images", async () => {
    const { prose } = await load();

    expect(prose).not.toMatch(/!?\[[^\]]+\]\([^)]+\)/);
  });
});
