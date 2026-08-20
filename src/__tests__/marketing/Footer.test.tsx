// src/__tests__/marketing/Footer.test.tsx

import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { Footer } from "@/components/ui/Footer";
import { theme } from "@/lib/theme";

jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

const renderit = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("Footer", () => {
  test("carries the guide and the legal links", () => {
    renderit(<Footer />);

    expect(screen.getByRole("link", { name: /^guide$/i })).toHaveAttribute(
      "href",
      "/guide",
    );
    expect(screen.getByRole("link", { name: /engineering/i })).toHaveAttribute(
      "href",
      "/how-its-built",
    );
    expect(screen.getByRole("link", { name: /privacy/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /terms/i })).toBeInTheDocument();
  });

  // "No footer on the landing page" used to be this component's job — it
  // checked usePathname and returned null on "/". The route groups now say it
  // structurally, so there is nothing left here to assert: the guarantee lives
  // in which layout renders it. Covered by landing.spec.ts, in a browser, where
  // the real layouts are the ones running.
});
