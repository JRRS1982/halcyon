// src/__tests__/marketing/NavBar.test.tsx

import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { NavBar } from "@/components/ui/NavBar";
import { theme } from "@/lib/theme";

let mockPathname = "/";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));
jest.mock("@/app/actions", () => ({ signOut: jest.fn() }));

const renderit = (props: {
  signedIn: boolean;
  transactionsEnabled: boolean;
  planVisible?: boolean;
}) =>
  render(
    <ThemeProvider theme={theme}>
      <NavBar planVisible={props.planVisible ?? false} {...props} />
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

  // /guide is not behind the auth guard, and it is the honest answer to "what
  // is this?" — so it is reachable from the bar before signing in, on the
  // homepage and off it.
  test.each(["/", "/sign-in"])("Guide is in the bar signed out on %s", (at) => {
    mockPathname = at;
    renderit({ signedIn: false, transactionsEnabled: false });
    expect(screen.getByRole("link", { name: /^guide$/i })).toHaveAttribute(
      "href",
      "/guide",
    );
  });

  // ...but not on the guide itself, where it would point at the current page.
  test("Guide is not in the bar when the guide is the page", () => {
    mockPathname = "/guide";
    renderit({ signedIn: false, transactionsEnabled: false });
    expect(
      screen.queryByRole("link", { name: /^guide$/i }),
    ).not.toBeInTheDocument();
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

  // Guide leads, because it is the page explaining the order of everything
  // after it. The rest follow how the app is used — import, categorise, budget,
  // balance, then read the dashboard — rather than putting the read-only view
  // first. Asserted as a sequence because "the links are all present" would
  // pass on any order at all.
  test("leads with the guide, then orders the links by the rhythm", () => {
    mockPathname = "/dashboard";
    const { container } = renderit({
      signedIn: true,
      transactionsEnabled: true,
      planVisible: true,
    });

    const hrefs = [...container.querySelectorAll("nav > div a")].map((a) =>
      a.getAttribute("href"),
    );

    expect(hrefs).toEqual([
      "/guide",
      "/transactions",
      "/budget",
      "/balance",
      "/dashboard",
      "/plan",
      "/settings",
    ]);
  });

  test("a disabled feature drops out without disturbing the rest", () => {
    mockPathname = "/dashboard";
    const { container } = renderit({
      signedIn: true,
      transactionsEnabled: false,
      planVisible: false,
    });

    const hrefs = [...container.querySelectorAll("nav > div a")].map((a) =>
      a.getAttribute("href"),
    );

    expect(hrefs).toEqual([
      "/guide",
      "/budget",
      "/balance",
      "/dashboard",
      "/settings",
    ]);
  });

  // The drawer is the only way to reach the nav below 768px, where the inline
  // link row and action cluster are display:none. Both sets are always in the
  // DOM and CSS decides which the viewport exposes — jsdom renders at desktop
  // width, so these assert the toggle's semantics with `hidden: true`. That
  // the drawer is the *visible* nav on a phone is covered by the mobile-nav
  // e2e spec, which runs at a real 390px viewport.
  describe("mobile drawer", () => {
    // The toggle is display:none at jsdom's desktop width, which zeroes its
    // computed accessible name, so reach for it by its aria-controls hook
    // rather than by role.
    const toggle = (container: HTMLElement) => {
      const button = container.querySelector<HTMLButtonElement>(
        'button[aria-controls="mobile-nav"]',
      );
      if (!button) throw new Error("menu toggle not rendered");
      return button;
    };
    const hrefs = (container: HTMLElement, href: string) =>
      container.querySelectorAll(`a[href="${href}"]`);

    test("stays closed until the menu toggle is pressed", () => {
      mockPathname = "/dashboard";
      const { container } = renderit({
        signedIn: true,
        transactionsEnabled: false,
      });

      expect(toggle(container)).toHaveAttribute("aria-expanded", "false");
      expect(toggle(container)).toHaveAttribute("aria-label", "Open menu");
      expect(container.querySelector("#mobile-nav")).not.toBeInTheDocument();
      expect(hrefs(container, "/budget")).toHaveLength(1);
    });

    test("opening it reveals the app links stacked in the drawer", () => {
      mockPathname = "/dashboard";
      const { container } = renderit({
        signedIn: true,
        transactionsEnabled: false,
      });

      fireEvent.click(toggle(container));

      expect(toggle(container)).toHaveAttribute("aria-expanded", "true");
      expect(toggle(container)).toHaveAttribute("aria-label", "Close menu");
      expect(container.querySelector("#mobile-nav")).toBeInTheDocument();
      // One in the inline row, one in the drawer.
      expect(hrefs(container, "/budget")).toHaveLength(2);
    });

    test("Escape closes it", () => {
      mockPathname = "/dashboard";
      const { container } = renderit({
        signedIn: true,
        transactionsEnabled: false,
      });

      fireEvent.click(toggle(container));
      fireEvent.keyDown(document, { key: "Escape" });

      expect(toggle(container)).toHaveAttribute("aria-expanded", "false");
      expect(hrefs(container, "/budget")).toHaveLength(1);
    });

    test("following a drawer link closes it", () => {
      mockPathname = "/dashboard";
      const { container } = renderit({
        signedIn: true,
        transactionsEnabled: false,
      });

      fireEvent.click(toggle(container));
      const drawerLink = container.querySelector(
        '#mobile-nav a[href="/budget"]',
      );
      if (!drawerLink) throw new Error("drawer link not rendered");
      fireEvent.click(drawerLink);

      expect(toggle(container)).toHaveAttribute("aria-expanded", "false");
    });

    test("signed-out drawer carries the sign-up and sign-in actions", () => {
      mockPathname = "/";
      const { container } = renderit({
        signedIn: false,
        transactionsEnabled: false,
      });

      fireEvent.click(toggle(container));

      const drawer = container.querySelector("#mobile-nav");
      expect(drawer?.querySelector('a[href="/sign-up"]')).toBeInTheDocument();
      expect(drawer?.querySelector('a[href="/sign-in"]')).toBeInTheDocument();
    });
  });
});
