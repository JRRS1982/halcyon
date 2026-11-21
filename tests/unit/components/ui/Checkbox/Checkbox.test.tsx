/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { ThemeProvider } from "styled-components";
import { Checkbox } from "@/components/ui/Checkbox";
import { theme } from "@/lib/theme";

const renderWithTheme = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

// The box is drawn, not native, so these guard what the drawing must not cost:
// it is still a checkbox to a keyboard, a screen reader and every caller.
describe("Checkbox", () => {
  it("reports whether it is ticked and tells its caller when it is clicked", () => {
    const onChange = jest.fn();
    renderWithTheme(
      <Checkbox checked onChange={onChange} aria-label="Select Rent" />,
    );

    const box = screen.getByRole("checkbox", { name: "Select Rent" });
    expect(box).toBeChecked();

    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reads as partly ticked while only some of what it covers is selected", () => {
    const { rerender } = renderWithTheme(
      <Checkbox
        indeterminate
        checked={false}
        onChange={() => {}}
        aria-label="Select all"
      />,
    );
    const box = screen.getByRole("checkbox", { name: "Select all" });
    expect(box).toBePartiallyChecked();

    rerender(
      <ThemeProvider theme={theme}>
        <Checkbox checked onChange={() => {}} aria-label="Select all" />
      </ThemeProvider>,
    );
    expect(box).not.toBePartiallyChecked();
    expect(box).toBeChecked();
  });
});
