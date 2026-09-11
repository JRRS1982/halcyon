import {
  type Block,
  parseInline,
  parseMarkdown,
  slugify,
} from "@/lib/design/markdown";

// The reader that stands between DESIGN.md and the page. Its contract is
// narrow on purpose: render the shapes the document uses, and throw on the
// rest rather than degrade to literal markdown on a published page.

describe("parseInline", () => {
  test("splits text, code, strong and emphasis", () => {
    expect(parseInline("plain `code` **bold** *lean*")).toEqual([
      { kind: "text", text: "plain " },
      { kind: "code", text: "code" },
      { kind: "text", text: " " },
      { kind: "strong", spans: [{ kind: "text", text: "bold" }] },
      { kind: "text", text: " " },
      { kind: "em", spans: [{ kind: "text", text: "lean" }] },
    ]);
  });

  // DESIGN.md names components as **`button-primary`** throughout. A flat
  // parse would print the backticks.
  test("nests code inside emphasis", () => {
    expect(parseInline("**`nav-bar`** — the top app nav.")).toEqual([
      { kind: "strong", spans: [{ kind: "code", text: "nav-bar" }] },
      { kind: "text", text: " — the top app nav." },
    ]);
  });

  test("leaves markers inside code alone", () => {
    expect(parseInline("`a*b*c`")).toEqual([{ kind: "code", text: "a*b*c" }]);
  });

  test("keeps a lone asterisk as text", () => {
    expect(parseInline("5 * 3")).toEqual([{ kind: "text", text: "5 * 3" }]);
  });
});

describe("slugify", () => {
  test("makes a stable anchor from a heading", () => {
    expect(slugify("Do's and Don'ts")).toBe("do-s-and-don-ts");
    expect(slugify("Elevation & Depth")).toBe("elevation-depth");
  });
});

describe("parseMarkdown", () => {
  test("reads the three heading levels with anchors", () => {
    expect(
      parseMarkdown("## Colors\n\n### Surface\n\n#### Breakpoints"),
    ).toEqual([
      { kind: "heading", level: 2, slug: "colors", text: "Colors" },
      { kind: "heading", level: 3, slug: "surface", text: "Surface" },
      {
        kind: "heading",
        level: 4,
        slug: "breakpoints",
        text: "Breakpoints",
      },
    ] satisfies Block[]);
  });

  test("joins a wrapped paragraph into one block", () => {
    const blocks = parseMarkdown("Colours chosen against white\n  go muddy.");

    expect(blocks).toEqual([
      {
        kind: "paragraph",
        spans: [
          { kind: "text", text: "Colours chosen against white go muddy." },
        ],
      },
    ]);
  });

  test("reads bulleted and numbered lists", () => {
    expect(parseMarkdown("- one\n- two")).toEqual([
      {
        kind: "list",
        isOrdered: false,
        items: [
          [{ kind: "text", text: "one" }],
          [{ kind: "text", text: "two" }],
        ],
      },
    ]);

    expect(parseMarkdown("1. first\n2. second")).toEqual([
      {
        kind: "list",
        isOrdered: true,
        items: [
          [{ kind: "text", text: "first" }],
          [{ kind: "text", text: "second" }],
        ],
      },
    ]);
  });

  test("a wrapped list item stays one item", () => {
    const blocks = parseMarkdown(
      "- colours chosen against white\n  go muddy\n- and again",
    );

    expect(blocks).toEqual([
      {
        kind: "list",
        isOrdered: false,
        items: [
          [{ kind: "text", text: "colours chosen against white go muddy" }],
          [{ kind: "text", text: "and again" }],
        ],
      },
    ]);
  });

  test("reads a table's head and body", () => {
    const blocks = parseMarkdown(
      "| Token | Size |\n|---|---|\n| `body-md` | 14 px |",
    );

    expect(blocks).toEqual([
      {
        kind: "table",
        head: [
          [{ kind: "text", text: "Token" }],
          [{ kind: "text", text: "Size" }],
        ],
        rows: [
          [
            [{ kind: "code", text: "body-md" }],
            [{ kind: "text", text: "14 px" }],
          ],
        ],
      },
    ]);
  });

  test("reads a horizontal rule", () => {
    expect(parseMarkdown("---")).toEqual([{ kind: "rule" }]);
  });

  // Silence is the failure mode worth guarding against: an unrendered
  // construct on a published page reads as a broken design system.
  test.each([
    ["an h1", "# Halcyon"],
    ["an h5", "##### Deep"],
    ["a fenced code block", "```ts\nconst a = 1;\n```"],
    ["a blockquote", "> quoted"],
    ["an indented block", "    const a = 1;"],
  ])("throws on %s", (_label, source) => {
    expect(() => parseMarkdown(source)).toThrow(/unsupported markdown/);
  });

  test("throws on a table with no divider row", () => {
    expect(() => parseMarkdown("| Token |\n| `body-md` |")).toThrow(
      /divider row/,
    );
  });
});
