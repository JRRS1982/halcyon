// src/__tests__/marketing/Footer.test.tsx
import MarketingLayout from "@/app/(marketing)/layout";
import { Footer } from "@/components/ui/Footer";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

const renderit = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("Footer", () => {
  test("carries the guide and the legal links", () => {
    renderit(<Footer />);

    expect(screen.getByRole("link", { name: /how it works/i })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(screen.getByRole("link", { name: /privacy/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /terms/i })).toBeInTheDocument();
  });

  // It used to check usePathname and return null on "/", so the landing page's
  // own MarketingFooter wasn't doubled up. The route groups now say that
  // structurally: the marketing layout simply doesn't render one. Asserted
  // here because "the footer knows to hide" and "the layout doesn't include
  // it" are the same guarantee expressed two ways, and only one of them is
  // still true.
  test("is not part of the marketing layout", () => {
    renderit(<MarketingLayout>{<p>landing</p>}</MarketingLayout>);

    expect(screen.getByText("landing")).toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });
});
