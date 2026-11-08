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
  test("leads with what Balanced is and the way in", () => {
    renderit();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /make sense of your money/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/see where your money went, category by category/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      "/sign-up",
    );
  });

  // The front page is articles that link out; the detail lives a click away.
  test("every feature article links to its own page", () => {
    renderit();
    for (const slug of [
      "transactions",
      "budget",
      "balance",
      "dashboard",
      "plan",
    ]) {
      expect(
        screen
          .getAllByRole("link")
          .some((link) => link.getAttribute("href") === `/features/${slug}`),
      ).toBe(true);
    }
  });

  test("closes with the guide and the engineering tour", () => {
    renderit();
    expect(
      screen.getByRole("link", { name: /how a month works/i }),
    ).toHaveAttribute("href", "/guide");
    expect(
      screen.getByRole("link", { name: /built to be used and trusted/i }),
    ).toHaveAttribute("href", "/how-its-built");
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
