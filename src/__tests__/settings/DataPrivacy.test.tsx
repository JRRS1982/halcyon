import { DataPrivacy } from "@/app/settings/DataPrivacy";
import { theme } from "@/lib/theme";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

jest.mock("@/app/settings/dataActions", () => ({
  exportMyData: jest.fn(async () => "{}"),
  clearMyData: jest.fn(async () => undefined),
  deleteMyAccount: jest.fn(async () => undefined),
}));

// useRouter() throws without an app-router context under jsdom — provide a stub.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <DataPrivacy />
    </ThemeProvider>,
  );

describe("DataPrivacy", () => {
  test("renders the three controls", () => {
    renderit();
    expect(
      screen.getByRole("button", { name: /export my data/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /clear my data/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete my account/i }),
    ).toBeInTheDocument();
  });

  test("delete button is disabled until the user types DELETE", () => {
    renderit();
    const del = screen.getByRole("button", { name: /delete my account/i });
    expect(del).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/type DELETE/i), {
      target: { value: "DELETE" },
    });
    expect(del).toBeEnabled();
  });
});
