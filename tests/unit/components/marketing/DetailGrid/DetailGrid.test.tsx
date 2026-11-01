// src/components/marketing/DetailGrid/DetailGrid.test.tsx

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

// The landing page's small print. If it drifts, a careful visitor loses the
// answers that decide whether they trust it with their numbers.
describe("DetailGrid", () => {
  test("has a #details anchor for the nav", () => {
    const { container } = renderit();
    expect(container.querySelector("#details")).toBeInTheDocument();
  });

  test("keeps the small print to six plain-English briefs", () => {
    renderit();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
    for (const key of [
      "It learns your merchants",
      "Transfers aren't spending",
      "A range, not a single number",
    ]) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
  });

  test("points to the guide for everything else", () => {
    renderit();
    expect(
      screen.getByRole("link", { name: /every detail is in the guide/i }),
    ).toHaveAttribute("href", "/guide");
  });
});
