import { CategoryCombobox } from "@/app/(app)/transactions/CategoryCombobox";
import { theme } from "@/lib/theme";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

// Deliberately unsorted so the alphabetical-within-group ordering is asserted,
// not inherited from the fixture.
const categories = [
  { id: "c2", label: "Rent", type: "EXPENSE" as const, section: "Fixed" },
  {
    id: "c1",
    label: "Groceries",
    type: "EXPENSE" as const,
    section: "Variable",
  },
  { id: "c3", label: "Salary", type: "INCOME" as const, section: "Pay" },
];

const accounts = [
  { id: "a2", name: "Savings" },
  { id: "a1", name: "Current" },
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

describe("CategoryCombobox flat grouped list", () => {
  test("renders income, expenses then transfers as one list with headings", () => {
    renderit({ transfersEnabled: true });
    openPopup();

    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getByText("Transfers")).toBeInTheDocument();

    const options = screen.getAllByRole("option").map((o) => o.textContent);
    // Income first, then expenses alphabetical, then the other accounts.
    expect(options[0]).toMatch(/salary/i);
    expect(options[1]).toMatch(/groceries/i);
    expect(options[2]).toMatch(/rent/i);
    expect(options[3]).toMatch(/savings/i);
  });

  test("transfer group excludes the transaction's own account", () => {
    renderit({ transfersEnabled: true });
    openPopup();
    expect(
      screen.queryByRole("option", { name: /current/i }),
    ).not.toBeInTheDocument();
  });

  test("no transfer group when transfers are disabled", () => {
    renderit();
    openPopup();
    expect(screen.queryByText("Transfers")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /savings/i }),
    ).not.toBeInTheDocument();
  });

  test("typing filters categories and accounts together", () => {
    renderit({ transfersEnabled: true });
    const input = openPopup();

    fireEvent.change(input, { target: { value: "sa" } });
    expect(
      screen.getByRole("option", { name: /salary/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /savings/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /rent/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Expenses")).not.toBeInTheDocument();
  });
});

describe("CategoryCombobox keyboard navigation", () => {
  test("ArrowDown moves through the grouped list in order and wraps", () => {
    renderit();
    const input = openPopup();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /salary/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

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

    // One more press wraps past the last option back to the first.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /salary/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("ArrowUp from no selection jumps to the last option", () => {
    renderit({ transfersEnabled: true });
    const input = openPopup();

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: /savings/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("Enter commits the highlighted category and closes the popup", () => {
    const { onSelect } = renderit();
    const input = openPopup();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("c1");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  test("Enter on a highlighted account commits the transfer", () => {
    const { onTransfer } = renderit({ transfersEnabled: true });
    const input = openPopup();

    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onTransfer).toHaveBeenCalledWith("a2");
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

  test("Enter with an account-only query and no highlight commits the transfer", () => {
    const { onTransfer } = renderit({ transfersEnabled: true });
    const input = openPopup();

    fireEvent.change(input, { target: { value: "savi" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onTransfer).toHaveBeenCalledWith("a2");
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

  test("the clear option participates when a value is set", () => {
    const { onSelect } = renderit({ value: "c1" });
    fireEvent.click(screen.getByRole("button", { name: /groceries/i }));
    const input = screen.getByRole("combobox");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
