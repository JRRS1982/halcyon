// src/__tests__/marketing/Hero.test.tsx
import { Hero } from "@/components/marketing/Hero";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <Hero />
    </ThemeProvider>,
  );

describe("Hero", () => {
  test("renders the headline as the page h1", () => {
    renderit();
    expect(
      screen.getByRole("heading", { level: 1, name: /make sense of your money/i }),
    ).toBeInTheDocument();
  });

  test("renders both CTAs pointing at sign-up and sign-in", () => {
    renderit();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/sign-up");
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/sign-in");
  });
});
