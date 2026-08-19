// src/__tests__/transactions/QuickAdd.test.tsx
import { QuickAdd } from "@/app/(app)/transactions/QuickAdd";
import { theme } from "@/lib/theme";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const createTransaction = jest.fn().mockResolvedValue({ id: "t1" });
jest.mock("@/app/(app)/transactions/actions", () => ({
  createTransaction: (input: unknown) => createTransaction(input),
}));

const accounts = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Current" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Joint" },
];

const categories = [
  {
    id: "33333333-3333-3333-3333-333333333333",
    label: "Groceries",
    type: "EXPENSE" as const,
    section: "Variable",
  },
];

const renderQuickAdd = () =>
  render(
    <ThemeProvider theme={theme}>
      <QuickAdd accounts={accounts} categories={categories} />
    </ThemeProvider>,
  );

describe("QuickAdd", () => {
  beforeEach(() => {
    createTransaction.mockClear();
    refresh.mockClear();
  });

  test("without an account there is nothing to add into", () => {
    render(
      <ThemeProvider theme={theme}>
        <QuickAdd accounts={[]} categories={[]} />
      </ThemeProvider>,
    );
    expect(
      screen.queryByRole("button", { name: /add transaction/i }),
    ).not.toBeInTheDocument();
  });

  test("submits a money-out amount as a negative, bank-signed figure", async () => {
    renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: /add transaction/i }));

    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "3.50" },
    });
    fireEvent.change(screen.getByPlaceholderText(/corner cafe/i), {
      target: { value: "Corner cafe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(createTransaction).toHaveBeenCalledTimes(1));
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: -3.5,
        description: "Corner cafe",
        accountId: accounts[0]?.id,
        categoryId: null,
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  test("money in stays positive and a chosen category is sent", async () => {
    renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: /add transaction/i }));

    fireEvent.click(screen.getByRole("button", { name: /money in/i }));
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByPlaceholderText(/corner cafe/i), {
      target: { value: "Refund" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /category/i }), {
      target: { value: categories[0]?.id },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(createTransaction).toHaveBeenCalledTimes(1));
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 20,
        categoryId: categories[0]?.id,
      }),
    );
  });

  test("a zero amount is stopped before the server is asked", async () => {
    renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: /add transaction/i }));

    const amountInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(amountInput, { target: { value: "0" } });
    fireEvent.change(screen.getByPlaceholderText(/corner cafe/i), {
      target: { value: "Nothing" },
    });
    // Submitted on the form directly: the input's own min="0.01" already stops
    // this in a real browser; this exercises the JS backstop behind it.
    const form = amountInput.closest("form");
    if (!form) throw new Error("form not found");
    fireEvent.submit(form);

    expect(
      await screen.findByText(/amount greater than zero/i),
    ).toBeInTheDocument();
    expect(createTransaction).not.toHaveBeenCalled();
  });
});
