// src/__tests__/marketing/MarketingShot.test.tsx
import { MarketingShot } from "@/components/marketing/MarketingShot";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = (props: Parameters<typeof MarketingShot>[0]) =>
  render(
    <ThemeProvider theme={theme}>
      <MarketingShot {...props} />
    </ThemeProvider>,
  );

describe("MarketingShot", () => {
  test("shows a labelled placeholder when no src is given", () => {
    renderit({ label: "Dashboard", caption: "Four charts", alt: "Dashboard" });
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Four charts")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("renders an image with alt text when src is given", () => {
    renderit({ src: "/marketing/dashboard.png", label: "Dashboard", alt: "Balanced dashboard" });
    expect(screen.getByRole("img", { name: "Balanced dashboard" })).toBeInTheDocument();
  });
});
