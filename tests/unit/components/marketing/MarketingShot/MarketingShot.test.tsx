// src/components/marketing/MarketingShot/MarketingShot.test.tsx

import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { MarketingShot } from "@/components/marketing/MarketingShot";
import { theme } from "@/lib/theme";

const renderit = (props: Parameters<typeof MarketingShot>[0]) =>
  render(
    <ThemeProvider theme={theme}>
      <MarketingShot {...props} />
    </ThemeProvider>,
  );

describe("MarketingShot", () => {
  test("shows a labelled placeholder when no src is given", () => {
    renderit({ label: "Dashboard", caption: "Four charts", alt: "Dashboard" });
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Four charts")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("renders an image with alt text when src is given", () => {
    renderit({
      src: "/marketing/dashboard.png",
      label: "Dashboard",
      alt: "Balanced dashboard",
    });
    expect(
      screen.getByRole("img", { name: "Balanced dashboard" }),
    ).toBeInTheDocument();
  });

  // A desktop plate at a phone's width is too small to read.
  test("shows the phone plate on a phone and the desktop plate above 760px", () => {
    const { container } = renderit({
      src: "/marketing/plates/balance.png",
      phone: {
        src: "/marketing/plates/balance-phone.png",
        aspect: "1170 / 960",
      },
      label: "Balance",
      alt: "The balance sheet",
    });
    const img = screen.getByRole("img", { name: "The balance sheet" });
    expect(img.getAttribute("src")).toContain("balance-phone.png");
    const source = container.querySelector("source");
    expect(source).toHaveAttribute("media", "(min-width: 761px)");
    expect(source?.getAttribute("srcset")).toContain("balance.png");
    expect(source?.getAttribute("srcset")).not.toContain("balance-phone.png");
  });

  // A light plate on a dark page glares; the dark plates must be the ones the
  // dark scheme shows, each still split by screen width.
  test("carries a dark set of plates alongside the light one", () => {
    const { container } = renderit({
      src: "/marketing/plates/balance.png",
      phone: {
        src: "/marketing/plates/balance-phone.png",
        aspect: "1170 / 960",
      },
      dark: {
        src: "/marketing/plates/balance-dark.png",
        phone: "/marketing/plates/balance-phone-dark.png",
      },
      label: "Balance",
      alt: "The balance sheet",
    });
    const [light, dark] = container.querySelectorAll("picture");
    expect(light?.querySelector("img")?.getAttribute("src")).toContain(
      "balance-phone.png",
    );
    expect(dark?.querySelector("img")?.getAttribute("src")).toContain(
      "balance-phone-dark.png",
    );
    expect(dark?.querySelector("source")?.getAttribute("srcset")).toContain(
      "balance-dark.png",
    );
  });
});
