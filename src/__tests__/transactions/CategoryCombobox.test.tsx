import { CategoryCombobox } from "@/app/transactions/CategoryCombobox";
import { theme } from "@/lib/theme";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const categories = [
  {
    id: "c1",
    label: "Groceries",
    type: "EXPENSE" as const,
    section: "Variable",
  },
  { id: "c2", label: "Rent", type: "EXPENSE" as const, section: "Fixed" },
  { id: "c3", label: "Salary", type: "INCOME" as const, section: "Income" },
];

const accounts = [
  { id: "a1", name: "Current" },
  { id: "a2", name: "Savings" },
];

const renderit = (overrides: Record<string, unknown> = {}) => {
  const onSelect = jest.fn();
  const onTransfer = jest.fn();
  render(
    <ThemeProvider theme={theme}>
      <CategoryCombobox
        categories={categories}
        accounts={accounts}
        value={null}
        transferAccountId={null}
        ownAccountId="a1"
        defaultType="EXPENSE"
        transfersEnabled={false}
        onSelect={onSelect}
        onCreate={jest.fn()}
        onTransfer={onTransfer}
        onCreateAccount={jest.fn()}
        {...overrides}
      />
    </ThemeProvider>,
  );
  return { onSelect, onTransfer };
};

const openPopup = () => {
  fireEvent.click(screen.getByRole("button", { name: /uncategorized/i }));
  return screen.getByRole("combobox");
};

describe("CategoryCombobox keyboard navigation", () => {
  test("ArrowDown moves the active option through the list and wraps", () => {
    renderit();
    const input = openPopup();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /groceries/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /rent/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Two more presses wrap past the last option back to the first.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /groceries/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("ArrowUp from no selection jumps to the last option", () => {
    renderit();
    const input = openPopup();

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: /salary/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("Enter commits the highlighted option and closes the popup", () => {
    const { onSelect } = renderit();
    const input = openPopup();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("c2");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  test("Enter with a query but no highlight commits the first match", () => {
    const { onSelect } = renderit();
    const input = openPopup();

    fireEvent.change(input, { target: { value: "sal" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("c3");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  test("Enter with no query and no highlight just closes", () => {
    const { onSelect } = renderit();
    const input = openPopup();

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  test("Escape closes without selecting", () => {
    const { onSelect } = renderit();
    const input = openPopup();

    fireEvent.keyDown(input, { key: "Escape" });

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  test("typing narrows matches and the highlight resets", () => {
    renderit();
    const input = openPopup();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.change(input, { target: { value: "gro" } });

    expect(screen.getByRole("option", { name: /groceries/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(
      screen.queryByRole("option", { name: /rent/i }),
    ).not.toBeInTheDocument();
  });

  test("static options (Transfer) participate in keyboard order", () => {
    renderit({ transfersEnabled: true });
    const input = openPopup();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /transfer/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Enter on "Transfer ▸" switches to the account panel rather than closing.
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /back to categories/i }),
    ).toBeInTheDocument();

    // Accounts other than the transaction's own are navigable.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /savings/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("Enter on a highlighted account commits the transfer", () => {
    const { onTransfer } = renderit({ transfersEnabled: true });
    const input = openPopup();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onTransfer).toHaveBeenCalledWith("a2");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
