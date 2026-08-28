import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { TaxBandsCard } from "@/app/(app)/plan/TaxBandsCard";
import type { Regime } from "@/lib/tax/types";
import { theme } from "@/lib/theme";

const renderCard = (regime: Regime) =>
  render(
    <ThemeProvider theme={theme}>
      <TaxBandsCard regime={regime} />
    </ThemeProvider>,
  );

describe("TaxBandsCard", () => {
  test("names the countries rather than the HMRC term of art", () => {
    renderCard("RUK");
    expect(
      screen.getByText(/England, Wales and Northern Ireland · 2025\/26/),
    ).toBeVisible();
  });

  test("shows the published thresholds, not the stored taxable ones", () => {
    renderCard("RUK");
    expect(screen.getByText("up to £12,570")).toBeVisible();
    expect(screen.getByText("£12,571 – £50,270")).toBeVisible();
    expect(screen.getByText("£50,271 – £125,140")).toBeVisible();
    expect(screen.getByText("over £125,140")).toBeVisible();
  });

  // The engine models the taper as a 60% band. It is a real marginal rate, but
  // it is not a published band, and showing one would read as a defect.
  test("describes the taper in words instead of showing a 60% band", () => {
    renderCard("RUK");
    expect(screen.queryByText("60%")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /allowance falls £1 for every £2 earned over £100,000, so it is gone by £125,140/,
      ),
    ).toBeVisible();
  });

  test("switches to Scotland's six bands", () => {
    renderCard("SCOTLAND");
    expect(screen.getByText("Starter rate")).toBeVisible();
    expect(screen.getByText("Advanced rate")).toBeVisible();
    expect(screen.getByText("Top rate")).toBeVisible();
    expect(screen.queryByText("67.5%")).not.toBeInTheDocument();
  });
});
