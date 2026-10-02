/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { ThemeProvider } from "styled-components";
import { RemoveCell } from "@/components/ui/RemoveCell";
import { theme } from "@/lib/theme";

const renderWithTheme = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

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
