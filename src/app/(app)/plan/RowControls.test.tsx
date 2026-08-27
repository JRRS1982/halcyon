/** @jest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { ThemeProvider } from "styled-components";
import { theme } from "@/lib/theme";
import { AddRowButton, RemoveCell } from "./RowControls";

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

describe("RemoveCell", () => {
  it("requires confirmation before calling onConfirm", async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    renderWithTheme(<RemoveCell onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /yes/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /yes/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it("cancel aborts and restores the Remove button", () => {
    const onConfirm = jest.fn();
    renderWithTheme(<RemoveCell onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /^remove$/i }),
    ).toBeInTheDocument();
  });
});
