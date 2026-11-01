// src/components/marketing/LandingPage/LandingPage.test.tsx

import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { LandingPage } from "@/components/marketing/LandingPage";
import { theme } from "@/lib/theme";

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <LandingPage />
    </ThemeProvider>,
  );

describe("LandingPage", () => {
  test("is set as a front page, inside pages, small print and sign-up", () => {
    renderit();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /make sense of your money/i,
      }),
    ).toBeInTheDocument();
    for (const name of [
      /your month, at a glance/i,
      /the monthly briefing/i,
      /inside: what balanced does/i,
      /where did the money go\? the budget tells you/i,
      /wealthy, or just spending/i,
      /a bank statement in, a sorted month out/i,
      /will the money last/i,
      /the small print, in plain english/i,
      /put the spreadsheet down/i,
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  // The nav's in-page links and the front page's teasers all land on these.
  test("carries every anchor the nav and teasers point at", () => {
    const { container } = renderit();
    for (const id of [
      "how",
      "features",
      "details",
      "budget",
      "balance",
      "plan",
    ]) {
      expect(container.querySelector(`#${id}`)).toBeInTheDocument();
    }
  });

  test("the footer is a sibling of main, not nested inside it", () => {
    // A <footer> nested inside <main> loses its contentinfo landmark role,
    // which breaks footer-scoped queries (and accessibility). Keep it outside.
    const { container } = renderit();
    const main = container.querySelector("main");
    const footer = container.querySelector("footer");
    expect(main).toBeInTheDocument();
    expect(footer).toBeInTheDocument();
    expect(main?.contains(footer ?? null)).toBe(false);
  });
});
