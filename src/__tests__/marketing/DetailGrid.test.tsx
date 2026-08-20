// src/__tests__/marketing/DetailGrid.test.tsx

import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { DetailGrid } from "@/components/marketing/DetailGrid";
import { theme } from "@/lib/theme";

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

  test("keeps the original detail items", () => {
    renderit();
    for (const key of [
      "Transfers aren't spending",
      "Live & in sync",
      "Duplicate-safe imports",
      "Reversible imports",
      "Notes & original detail",
      "Your data, yours",
    ]) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
  });

  test("groups fifteen items under five headings", () => {
    const { container } = renderit();
    expect(container.querySelectorAll("h3")).toHaveLength(5);
    // Each group is exactly one row of the three-up grid.
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(5);
  });

  test("covers the features the app has grown since launch", () => {
    renderit();
    expect(screen.getByText("It learns your merchants")).toBeInTheDocument();
    expect(screen.getByText("Carried-over values say so")).toBeInTheDocument();
    expect(
      screen.getByText("An email with no numbers in it"),
    ).toBeInTheDocument();
  });
});
