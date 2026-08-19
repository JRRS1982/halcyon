// src/__tests__/dashboard/MonthChecklist.test.tsx
import { MonthChecklist } from "@/app/(app)/dashboard/MonthChecklist";
import { monthChecklist } from "@/lib/dashboard/checklist";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderChecklist = (checklist: ReturnType<typeof monthChecklist>) =>
  render(
    <ThemeProvider theme={theme}>
      <MonthChecklist checklist={checklist} monthLabel="Aug 2026" />
    </ThemeProvider>,
  );

describe("MonthChecklist", () => {
  test("names the month it tracks", () => {
    renderChecklist(
      monthChecklist({
        transactionsEnabled: true,
        hasBudgetItems: true,
        hasBalanceItems: true,
        uncategorizedCount: 0,
      }),
    );
    expect(screen.getByText(/this month · aug 2026/i)).toBeInTheDocument();
  });

  test("outstanding stages are links to where the work happens", () => {
    renderChecklist(
      monthChecklist({
        transactionsEnabled: true,
        hasBudgetItems: true,
        hasBalanceItems: false,
        uncategorizedCount: 3,
      }),
    );
    expect(
      screen.getByRole("link", { name: /3 transactions to categorise/i }),
    ).toHaveAttribute("href", "/transactions");
    expect(
      screen.getByRole("link", { name: /update your balances/i }),
    ).toHaveAttribute("href", "/balance");
  });

  test("finished stages are plain text, not links", () => {
    renderChecklist(
      monthChecklist({
        transactionsEnabled: true,
        hasBudgetItems: true,
        hasBalanceItems: true,
        uncategorizedCount: 0,
      }),
    );
    expect(screen.getByText(/budget sheet in place/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /budget sheet in place/i }),
    ).not.toBeInTheDocument();
  });

  test("says so when the month is fully logged", () => {
    renderChecklist(
      monthChecklist({
        transactionsEnabled: false,
        hasBudgetItems: true,
        hasBalanceItems: true,
        uncategorizedCount: 0,
      }),
    );
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });
});
