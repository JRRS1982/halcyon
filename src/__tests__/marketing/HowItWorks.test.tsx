// src/__tests__/marketing/HowItWorks.test.tsx
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <HowItWorks />
    </ThemeProvider>,
  );

describe("HowItWorks", () => {
  test("has a #how anchor for the nav link", () => {
    const { container } = renderit();
    expect(container.querySelector("#how")).toBeInTheDocument();
  });

  test("renders both paths and the converge step", () => {
    renderit();
    expect(
      screen.getByText(/let your statements do the work/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/type the figures in yourself/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/see where you stand/i)).toBeInTheDocument();
  });

  test("renders a one-time setup step and a four-step monthly loop", () => {
    renderit();
    expect(screen.getByText(/setup · once/i)).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    for (const marker of ["01", "02", "03", "04"]) {
      expect(screen.getByText(marker)).toBeInTheDocument();
    }
    expect(screen.getByText(/repeat monthly/i)).toBeInTheDocument();
  });
});
