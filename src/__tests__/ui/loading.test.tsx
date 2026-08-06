// src/__tests__/ui/loading.test.tsx
import BalanceLoading from "@/app/(app)/balance/loading";
import BudgetLoading from "@/app/(app)/budget/loading";
import DashboardLoading from "@/app/(app)/dashboard/loading";
import PlanLoading from "@/app/(app)/plan/loading";
import SettingsLoading from "@/app/(app)/settings/loading";
import TransactionsLoading from "@/app/(app)/transactions/loading";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const ROUTES = [
  ["budget", BudgetLoading, /loading your budget/i],
  ["balance", BalanceLoading, /loading your balance sheet/i],
  ["dashboard", DashboardLoading, /loading your dashboard/i],
  ["transactions", TransactionsLoading, /loading your transactions/i],
  ["settings", SettingsLoading, /loading your settings/i],
  ["plan", PlanLoading, /loading your plan/i],
] as const;

describe("route loading states", () => {
  // A grid of grey rectangles tells a screen-reader user nothing, so every
  // skeleton has to carry a live region naming what is on its way.
  test.each(ROUTES)("%s announces itself as busy", (_name, Loading, label) => {
    renderit(<Loading />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  test("the sheet routes show a Loading pip in the header", () => {
    renderit(<BudgetLoading />);
    expect(screen.getByText(/loading…/i)).toBeInTheDocument();
  });
});
