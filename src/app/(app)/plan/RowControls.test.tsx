/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { ThemeProvider } from "styled-components";
import { theme } from "@/lib/theme";
import { AddRowButton } from "./RowControls";

const renderWithTheme = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("AddRowButton", () => {
  // Every create* action is a write with no form around it, so a second click
  // before the first settles would add a second row. Disabling beats
  // debouncing: a debounce delays the first click, disabling stops the second
  // one ever reaching the action.
  it("disables itself until the add settles, so a double-click adds one row", async () => {
    let settle: () => void = () => {};
    const onAdd = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );
    renderWithTheme(<AddRowButton label="asset" onAdd={onAdd} />);
    const button = screen.getByRole("button", { name: "+ asset" });

    fireEvent.click(button);
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onAdd).toHaveBeenCalledTimes(1);

    await act(async () => {
      settle();
    });
    expect(button).not.toBeDisabled();
  });
});
