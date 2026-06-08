// src/__tests__/marketing/CtaBand.test.tsx
import { CtaBand } from "@/components/marketing/CtaBand";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <CtaBand />
    </ThemeProvider>,
  );

describe("CtaBand", () => {
  test("renders the closing headline and a Get started link to sign-up", () => {
    renderit();
    expect(screen.getByRole("heading", { name: /put the spreadsheet down/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/sign-up");
  });
});
