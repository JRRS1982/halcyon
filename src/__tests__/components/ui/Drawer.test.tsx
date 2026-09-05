/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { ThemeProvider } from "styled-components";
import { Drawer, DrawerSection } from "@/components/ui/Drawer";
import { theme } from "@/lib/theme";

const renderWithTheme = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const noop = () => {};

describe("Drawer", () => {
  it("closes via the close button, scrim, and Escape", () => {
    const onClose = jest.fn();
    renderWithTheme(
      <Drawer
        open
        eyebrow="Account"
        title="ISA"
        onClose={onClose}
        onRemove={noop}
      >
        <p>body</p>
      </Drawer>,
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    fireEvent.click(screen.getByTestId("plan-drawer-scrim"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("renders title + children only when open", () => {
    const { rerender } = renderWithTheme(
      <Drawer open={false} title="ISA" onClose={noop} onRemove={noop}>
        <p>body</p>
      </Drawer>,
    );
    expect(screen.queryByText("body")).not.toBeInTheDocument();
    rerender(
      <ThemeProvider theme={theme}>
        <Drawer open title="ISA" onClose={noop} onRemove={noop}>
          <p>body</p>
        </Drawer>
      </ThemeProvider>,
    );
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "ISA" })).toBeInTheDocument();
  });

  it("is a modal dialog and moves focus into the sheet when open", () => {
    renderWithTheme(
      <Drawer open title="ISA" onClose={noop} onRemove={noop}>
        <p>body</p>
      </Drawer>,
    );
    const dialog = screen.getByRole("dialog", { name: "ISA" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
  });

  it("DrawerSection toggles its body", () => {
    renderWithTheme(
      <DrawerSection title="Growth" defaultOpen={false}>
        <p>inner</p>
      </DrawerSection>,
    );
    expect(screen.queryByText("inner")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /growth/i }));
    expect(screen.getByText("inner")).toBeInTheDocument();
  });
});
