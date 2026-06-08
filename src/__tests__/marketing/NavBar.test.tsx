// src/__tests__/marketing/NavBar.test.tsx
import { NavBar } from "@/components/ui/NavBar";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

let mockPathname = "/";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));
jest.mock("@/app/actions", () => ({ signOut: jest.fn() }));

const renderit = (props: { signedIn: boolean; transactionsEnabled: boolean }) =>
  render(
    <ThemeProvider theme={theme}>
      <NavBar {...props} />
    </ThemeProvider>,
  );

describe("NavBar", () => {
  test("brand reads 'Balanced Money'", () => {
    mockPathname = "/";
    renderit({ signedIn: false, transactionsEnabled: false });
    expect(screen.getByText("Balanced Money")).toBeInTheDocument();
  });

  test("signed-out homepage shows marketing anchors + Get started", () => {
    mockPathname = "/";
    renderit({ signedIn: false, transactionsEnabled: false });
    expect(screen.getByRole("link", { name: /how it works/i })).toHaveAttribute(
      "href",
      "#how",
    );
    expect(screen.getByRole("link", { name: /features/i })).toHaveAttribute(
      "href",
      "#features",
    );
    expect(screen.getByRole("link", { name: /details/i })).toHaveAttribute(
      "href",
      "#details",
    );
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      "/sign-up",
    );
    expect(screen.getByRole("link", { name: /^sign in$/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  test("signed-out non-home hides anchors but keeps Get started", () => {
    mockPathname = "/sign-in";
    renderit({ signedIn: false, transactionsEnabled: false });
    expect(
      screen.queryByRole("link", { name: /how it works/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      "/sign-up",
    );
  });

  test("signed-in with transactions enabled shows a Transactions link", () => {
    mockPathname = "/dashboard";
    renderit({ signedIn: true, transactionsEnabled: true });
    expect(screen.getByRole("link", { name: /transactions/i })).toHaveAttribute(
      "href",
      "/transactions",
    );
  });

  test("signed-in shows app links without 'Home' and a Sign out button", () => {
    mockPathname = "/dashboard";
    renderit({ signedIn: true, transactionsEnabled: false });
    expect(
      screen.queryByRole("link", { name: /^home$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /dashboard/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign out/i }),
    ).toBeInTheDocument();
  });
});
