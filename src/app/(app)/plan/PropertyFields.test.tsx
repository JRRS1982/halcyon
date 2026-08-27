/** @jest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { theme } from "@/lib/theme";
import { PropertyFields } from "./PropertyFields";

const createMortgageForProperty = jest.fn().mockResolvedValue("liab-1");
const updatePlanLiability = jest.fn().mockResolvedValue(undefined);
const updatePlanExpense = jest.fn().mockResolvedValue(undefined);
const deletePlanLiability = jest.fn().mockResolvedValue(undefined);
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("./actions", () => ({
  updatePlanAsset: jest.fn().mockResolvedValue(undefined),
  updatePlanLiability: (...a: unknown[]) => updatePlanLiability(...a),
  updatePlanExpense: (...a: unknown[]) => updatePlanExpense(...a),
  createMortgageForProperty: (...a: unknown[]) =>
    createMortgageForProperty(...a),
  deletePlanLiability: (...a: unknown[]) => deletePlanLiability(...a),
}));

const property = {
  id: "asset-1",
  label: "Home",
  wrapper: "PROPERTY" as const,
  openingValue: 300000,
  expectedReturnPct: 3,
  feePct: 0,
  annualContribution: 0,
  contributionEndAge: null,
  minAccessAge: null,
  drawdownPriority: 0,
};

const mortgage = {
  id: "liab-1",
  label: "Mortgage",
  openingBalance: 200000,
  interestPct: 4,
  monthlyRepayment: 1200,
  startAge: null,
  endAge: null,
  linkedAssetId: "asset-1",
  interestOnly: false,
};
const repayment = {
  id: "exp-1",
  label: "Mortgage repayment",
  category: "FIXED" as const,
  annualAmount: 14400,
  startAge: null,
  endAge: null,
  inflationLinked: false,
  liabilityId: "liab-1",
};

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("PropertyFields", () => {
  it("shows an Add mortgage action when the property has no mortgage", () => {
    renderWithTheme(
      <PropertyFields
        property={property}
        mortgage={undefined}
        repayment={undefined}
      />,
    );
    expect(
      screen.getByRole("button", { name: /add mortgage/i }),
    ).toBeInTheDocument();
  });

  it("calls createMortgageForProperty with the property id on Add mortgage", async () => {
    renderWithTheme(
      <PropertyFields
        property={property}
        mortgage={undefined}
        repayment={undefined}
      />,
    );
    // The click starts an async action that settles state when it finishes, so
    // the interaction has to be awaited rather than asserted on mid-flight.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /add mortgage/i }));
    });
    expect(createMortgageForProperty).toHaveBeenCalledWith({
      assetId: "asset-1",
    });
  });

  it("shows mortgage fields when a mortgage exists", () => {
    renderWithTheme(
      <PropertyFields
        property={property}
        mortgage={mortgage}
        repayment={repayment}
      />,
    );
    expect(screen.getByText(/balance/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove mortgage/i }),
    ).toBeInTheDocument();
  });

  it("preserves the linkedAssetId when committing the Balance field", async () => {
    renderWithTheme(
      <PropertyFields
        property={property}
        mortgage={mortgage}
        repayment={repayment}
      />,
    );
    const input = screen.getByDisplayValue(String(mortgage.openingBalance));
    fireEvent.change(input, { target: { value: "250000" } });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(updatePlanLiability).toHaveBeenCalledWith(
        expect.objectContaining({
          liabilityId: mortgage.id,
          openingBalance: 250000,
          linkedAssetId: "asset-1",
        }),
      ),
    );
  });

  it("converts the monthly repayment to an annual amount on commit", async () => {
    renderWithTheme(
      <PropertyFields
        property={property}
        mortgage={mortgage}
        repayment={repayment}
      />,
    );
    const monthly = Math.round(repayment.annualAmount / 12);
    const input = screen.getByDisplayValue(String(monthly));
    fireEvent.change(input, { target: { value: "1500" } });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(updatePlanExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          expenseId: repayment.id,
          annualAmount: 1500 * 12,
        }),
      ),
    );
  });

  it("calls deletePlanLiability with the mortgage id on Remove mortgage", async () => {
    renderWithTheme(
      <PropertyFields
        property={property}
        mortgage={mortgage}
        repayment={repayment}
      />,
    );
    // See Add mortgage above: awaited, same assertion.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /remove mortgage/i }));
    });
    expect(deletePlanLiability).toHaveBeenCalledWith({ id: mortgage.id });
  });

  // A mortgage is created by a bare button with no form and no navigation
  // behind it, so nothing but the disabled state stops a second click landing
  // while the first is still in flight and creating a second mortgage.
  it("disables Add mortgage until it settles, so a double-click adds one", async () => {
    let settle: (id: string) => void = () => {};
    // Nothing in this file clears mocks between tests, and an earlier test
    // already clicked this button — so the count starts from zero here.
    createMortgageForProperty.mockClear();
    createMortgageForProperty.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          settle = resolve;
        }),
    );
    renderWithTheme(
      <PropertyFields
        property={property}
        mortgage={undefined}
        repayment={undefined}
      />,
    );
    const button = screen.getByRole("button", { name: /add mortgage/i });

    fireEvent.click(button);
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(createMortgageForProperty).toHaveBeenCalledTimes(1);

    await act(async () => {
      settle("liab-1");
    });
    expect(button).not.toBeDisabled();
  });

  it("toggling interest-only calls updatePlanLiability with interestOnly true", () => {
    renderWithTheme(
      <PropertyFields
        property={property}
        mortgage={mortgage}
        repayment={repayment}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /interest-only/i }));
    expect(updatePlanLiability).toHaveBeenCalledWith(
      expect.objectContaining({ interestOnly: true }),
    );
  });

  it("hides the editable monthly repayment when interest-only", () => {
    renderWithTheme(
      <PropertyFields
        property={property}
        mortgage={{ ...mortgage, interestOnly: true }}
        repayment={repayment}
      />,
    );
    expect(screen.queryByLabelText(/repayment \/mo/i)).not.toBeInTheDocument();
  });

  it("shows the interest/principal readout when a currentSplit is provided", () => {
    renderWithTheme(
      <PropertyFields
        property={property}
        mortgage={mortgage}
        repayment={repayment}
        currentSplit={{ interest: 5000, principal: 7000 }}
      />,
    );
    // "Interest %" and "Interest-only" are both existing field labels, so a
    // bare /interest/i query is ambiguous — assert on the combined readout
    // text (the one element mentioning both interest and principal).
    expect(screen.getByText(/interest.*principal/i)).toBeInTheDocument();
  });
});
