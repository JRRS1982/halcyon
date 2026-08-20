// src/__tests__/marketing/MarketingFooter.test.tsx

import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { theme } from "@/lib/theme";

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <MarketingFooter />
    </ThemeProvider>,
  );

describe("MarketingFooter", () => {
  test("renders brand and legal links", () => {
    renderit();
    expect(screen.getByText("Balanced Money")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /terms of service/i }),
    ).toHaveAttribute("href", "/terms");
    expect(
      screen.getByRole("link", { name: /privacy policy/i }),
    ).toHaveAttribute("href", "/privacy");
    expect(
      screen.getByRole("link", { name: /cookie policy/i }),
    ).toHaveAttribute("href", "/cookies");
  });
});
