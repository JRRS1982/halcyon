/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { ThemeProvider } from "styled-components";
import { theme } from "@/lib/theme";
import { DrawerSection, PlanDrawer } from "./PlanDrawer";

const renderWithTheme = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const noop = () => {};

describe("PlanDrawer", () => {
  it("closes via the close button, scrim, and Escape", () => {
    const onClose = jest.fn();
    renderWithTheme(
      <PlanDrawer
        open
        eyebrow="Account"
        title="ISA"
        onClose={onClose}
        onRemove={noop}
      >
        <p>body</p>
      </PlanDrawer>,
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    fireEvent.click(screen.getByTestId("plan-drawer-scrim"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("renders title + children only when open", () => {
    const { rerender } = renderWithTheme(
      <PlanDrawer open={false} title="ISA" onClose={noop} onRemove={noop}>
        <p>body</p>
      </PlanDrawer>,
    );
    expect(screen.queryByText("body")).not.toBeInTheDocument();
    rerender(
      <ThemeProvider theme={theme}>
        <PlanDrawer open title="ISA" onClose={noop} onRemove={noop}>
          <p>body</p>
        </PlanDrawer>
      </ThemeProvider>,
    );
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "ISA" })).toBeInTheDocument();
  });

  it("is a modal dialog and moves focus into the sheet when open", () => {
    renderWithTheme(
      <PlanDrawer open title="ISA" onClose={noop} onRemove={noop}>
        <p>body</p>
      </PlanDrawer>,
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
