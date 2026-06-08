// src/__tests__/marketing/DetailGrid.test.tsx
import { DetailGrid } from "@/components/marketing/DetailGrid";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <DetailGrid />
    </ThemeProvider>,
  );

describe("DetailGrid", () => {
  test("has a #details anchor", () => {
    const { container } = renderit();
    expect(container.querySelector("#details")).toBeInTheDocument();
  });

  test("renders the six detail items including transfers and live-sync", () => {
    renderit();
    expect(screen.getByText("Transfers aren't spending")).toBeInTheDocument();
    expect(screen.getByText("Live & in sync")).toBeInTheDocument();
    expect(screen.getByText("Your data, yours")).toBeInTheDocument();
  });
});
