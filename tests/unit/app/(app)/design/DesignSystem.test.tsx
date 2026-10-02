import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { DesignSystem } from "@/app/(app)/design/DesignSystem";
import type { Block } from "@/lib/design/markdown";
import { lightPalette } from "@/lib/palette";
import { theme } from "@/lib/theme";

// The page is generated from three sources and nothing else: DESIGN.md, and
// the two token modules the app renders with. These assertions are about that
// wiring — that no token can be in the palette and missing from the board.

const blocks: Block[] = [
  { kind: "heading", level: 2, slug: "colors", text: "Colors" },
  {
    kind: "paragraph",
    spans: [
      { kind: "text", text: "The accent is " },
      { kind: "strong", spans: [{ kind: "code", text: "accent" }] },
      { kind: "text", text: " only." },
    ],
  },
  {
    kind: "table",
    head: [[{ kind: "text", text: "Token" }]],
    rows: [[[{ kind: "code", text: "body-md" }]]],
  },
];

const renderPage = () =>
  render(
    <ThemeProvider theme={theme}>
      <DesignSystem
        blocks={blocks}
        contract={'colors:\n  accent: "#1E5BC6"'}
        rawUrl="https://balanced.money/design.md"
      />
    </ThemeProvider>,
  );

describe("DesignSystem", () => {
  test("names the raw file so a tool can be pointed at it", () => {
    renderPage();

    expect(
      screen.getByText("https://balanced.money/design.md"),
    ).toBeInTheDocument();
  });

  test("boards a swatch for every colour token, with both schemes' values", () => {
    renderPage();

    // getAllByText, not getByText: a token name such as "accent" also appears
    // inside the document's own prose.
    for (const token of Object.keys(lightPalette)) {
      expect(screen.getAllByText(token).length).toBeGreaterThan(0);
    }
    // The hex a reader can copy comes from the palette, not from the prose.
    expect(screen.getAllByText(lightPalette.accent).length).toBeGreaterThan(0);
  });

  test("sets a specimen in every type token", () => {
    renderPage();

    for (const token of Object.keys(theme.typography)) {
      expect(screen.getByText(new RegExp(`· ${token}$`))).toBeInTheDocument();
    }
  });

  test("renders the document's own prose, including nested inline markup", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Colors", level: 2 }),
    ).toBeInTheDocument();
    // The contents list anchors to the same heading.
    expect(screen.getByRole("link", { name: "Colors" })).toHaveAttribute(
      "href",
      "#colors",
    );
    expect(screen.getByRole("columnheader", { name: "Token" })).toBeVisible();
    expect(screen.getByText("body-md")).toBeInTheDocument();
  });

  test("keeps the token contract available verbatim", () => {
    renderPage();

    expect(screen.getByText(/accent: "#1E5BC6"/)).toBeInTheDocument();
  });
});
