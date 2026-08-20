/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { ThemeProvider } from "styled-components";
import { theme } from "@/lib/theme";
import { NumberCell, TextCell } from "./EditableCell";

const renderWithTheme = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("NumberCell", () => {
  it("reverts a cleared REQUIRED field instead of silently saving 0 (data-loss guard)", async () => {
    const onCommit = jest.fn();
    renderWithTheme(<NumberCell value={1000} onCommit={onCommit} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    await waitFor(() => expect(input).toHaveValue(1000));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits null when a NULLABLE field is cleared", async () => {
    const onCommit = jest.fn().mockResolvedValue(undefined);
    renderWithTheme(<NumberCell value={67} nullable onCommit={onCommit} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(null));
  });

  it("commits a changed number", async () => {
    const onCommit = jest.fn().mockResolvedValue(undefined);
    renderWithTheme(<NumberCell value={1000} onCommit={onCommit} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "2000" } });
    fireEvent.blur(input);
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(2000));
  });

  it("does not commit when the value is unchanged", async () => {
    const onCommit = jest.fn().mockResolvedValue(undefined);
    renderWithTheme(<NumberCell value={1000} onCommit={onCommit} />);
    fireEvent.blur(screen.getByRole("spinbutton"));
    await Promise.resolve();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("reverts to the persisted value when the save is rejected", async () => {
    const onCommit = jest.fn().mockRejectedValue(new Error("nope"));
    renderWithTheme(<NumberCell value={1000} onCommit={onCommit} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "2000" } });
    fireEvent.blur(input);
    await waitFor(() => expect(input).toHaveValue(1000));
  });
});

describe("TextCell", () => {
  it("reverts a cleared required text field", async () => {
    const onCommit = jest.fn();
    renderWithTheme(<TextCell value="SIPP" onCommit={onCommit} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    await waitFor(() => expect(input).toHaveValue("SIPP"));
    expect(onCommit).not.toHaveBeenCalled();
  });
});
