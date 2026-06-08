// src/__tests__/marketing/LandingPage.test.tsx
import { LandingPage } from "@/components/marketing/LandingPage";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <LandingPage />
    </ThemeProvider>,
  );

describe("LandingPage", () => {
  test("composes hero, how-it-works, features, details and CTA", () => {
    renderit();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /make sense of your money/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/let your statements do the work/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /budget — then learn how you really spend/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /wealthy, or just spending/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /turn a bank statement into understanding/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Transfers aren't spending")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /put the spreadsheet down/i }),
    ).toBeInTheDocument();
  });

  test("features intro carries the #features anchor", () => {
    const { container } = renderit();
    expect(container.querySelector("#features")).toBeInTheDocument();
  });
});
