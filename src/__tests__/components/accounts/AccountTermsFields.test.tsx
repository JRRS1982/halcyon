/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { ThemeProvider } from "styled-components";
import { AccountTermsFields } from "@/components/accounts/AccountTermsFields";
import { theme } from "@/lib/theme";

const renderWithTheme = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const noTerms = {};

describe("AccountTermsFields", () => {
  it("renders exactly the fields a mortgage prompts for", () => {
    renderWithTheme(
      <AccountTermsFields
        type="MORTGAGE"
        value={noTerms}
        onChange={() => {}}
      />,
    );

    expect(screen.getByLabelText("Interest rate %")).toBeInTheDocument();
    expect(screen.getByLabelText("Interest only")).toBeInTheDocument();
    expect(screen.getByLabelText("Fixed until")).toBeInTheDocument();
    expect(screen.getByLabelText("Rate after that %")).toBeInTheDocument();
    expect(screen.getByLabelText("Paid off by")).toBeInTheDocument();
    // A mortgage is not an investment.
    expect(screen.queryByLabelText("Platform fee %")).not.toBeInTheDocument();
  });

  it("offers a property no platform fee", () => {
    renderWithTheme(
      <AccountTermsFields
        type="PROPERTY"
        value={noTerms}
        onChange={() => {}}
      />,
    );

    expect(screen.getByLabelText("Expected growth %")).toBeInTheDocument();
    expect(screen.queryByLabelText("Platform fee %")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Interest rate %")).not.toBeInTheDocument();
  });

  it("reports a change without mutating the value it was given", () => {
    const value = { expectedReturnPct: 5 };
    const onChange = jest.fn();
    renderWithTheme(
      <AccountTermsFields
        type="STOCKS_ISA"
        value={value}
        onChange={onChange}
      />,
    );

    const input = screen.getByLabelText("Expected growth %");
    fireEvent.change(input, { target: { value: "4" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith({ expectedReturnPct: 4 });
    expect(value).toEqual({ expectedReturnPct: 5 });
  });

  it("shows the default as a placeholder when a parameter is blank", () => {
    renderWithTheme(
      <AccountTermsFields
        type="STOCKS_ISA"
        value={noTerms}
        onChange={() => {}}
      />,
    );

    // Blank means take the default, so the field says which default applies
    // rather than showing a 0 the user never typed.
    expect(screen.getByLabelText("Platform fee %")).toHaveAttribute(
      "placeholder",
      "0",
    );
  });
});
