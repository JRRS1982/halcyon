/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { theme } from "@/lib/theme";
import { AssumptionsPanel } from "./AssumptionsPanel";
import type { SerializedPlanAssumptions } from "./serialized";

const updatePlanAssumptions = jest.fn().mockResolvedValue(undefined);
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("./actions", () => ({
  updatePlanAssumptions: (...a: unknown[]) => updatePlanAssumptions(...a),
}));

const base: SerializedPlanAssumptions = {
  id: "plan-1",
  dateOfBirth: "1986-06-01",
  retirementAge: 65,
  planToAge: 95,
  inflationPct: 2.5,
  defaultReturnPct: 5,
  returnSpreadPct: 2,
  taxRegime: "RUK",
  thresholdsInflationLinked: true,
  statePensionAge: 67,
  statePensionAnnual: 11500,
  expectedDeathAge: 90,
};

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("AssumptionsPanel", () => {
  it("offers a regime choice, not a tax rate", () => {
    renderWithTheme(<AssumptionsPanel assumptions={base} />);
    expect(screen.queryByLabelText(/tax rate/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/tax regime/i)).toHaveValue("RUK");
    expect(
      screen.getByLabelText(/thresholds rise with inflation/i),
    ).toBeChecked();
  });

  it("changing the regime saves the new value", async () => {
    renderWithTheme(<AssumptionsPanel assumptions={base} />);
    fireEvent.change(screen.getByLabelText(/tax regime/i), {
      target: { value: "SCOTLAND" },
    });
    await waitFor(() =>
      expect(updatePlanAssumptions).toHaveBeenCalledWith(
        expect.objectContaining({ taxRegime: "SCOTLAND" }),
      ),
    );
  });
});
