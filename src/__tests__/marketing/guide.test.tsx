// src/__tests__/marketing/guide.test.tsx

import { render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { Guide } from "@/app/(app)/guide/Guide";
import { theme } from "@/lib/theme";

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <Guide />
    </ThemeProvider>,
  );

describe("Guide", () => {
  test("leads with what the app is", () => {
    renderit();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /how balanced money works/i,
      }),
    ).toBeInTheDocument();
  });

  // The guide's job is to answer "what do I actually do each month", so the
  // sequence has to be a real ordered list, in order — not prose.
  test("spells out the monthly routine as ordered steps", () => {
    renderit();
    const steps = screen.getByRole("list");
    const items = within(steps).getAllByRole("listitem");

    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent(/import last month's statement/i);
    expect(items[1]).toHaveTextContent(/categorise/i);
    expect(items[2]).toHaveTextContent(/read the budget/i);
    expect(items[3]).toHaveTextContent(/update your balances/i);
    expect(items[4]).toHaveTextContent(/look at the dashboard/i);
  });

  test("covers every section of the app", () => {
    renderit();
    for (const section of [
      "Transactions",
      "Budget",
      "Balance",
      "Dashboard",
      "Plan",
      "Settings",
    ]) {
      expect(
        screen.getByRole("heading", { name: section, level: 3 }),
      ).toBeInTheDocument();
    }
  });

  test("links onward to the pages it describes", () => {
    renderit();
    expect(
      screen.getAllByRole("link", { name: /transactions|import a statement/i })
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: /start with a budget/i }),
    ).toHaveAttribute("href", "/budget");
  });

  // "We never see your bank login" is the answer to the first objection a
  // finance app meets, and it was previously buried in docs/.
  test("states the no-bank-connection position", () => {
    renderit();
    expect(
      screen.getByText(/never connects to your bank/i),
    ).toBeInTheDocument();
  });
});
