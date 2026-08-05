// src/__tests__/marketing/home-route.test.tsx
import Home from "@/app/page";
import { theme } from "@/lib/theme";
import { render } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

// "/" no longer performs its own session check — the proxy redirects signed-in
// visitors before the request reaches this component, which saves a second
// getUser() round-trip on the marketing page. The redirect itself is covered
// by src/__tests__/security/proxy-redirects.test.ts.
describe("Home route", () => {
  test("renders the landing page without an auth round-trip", () => {
    const { getByRole } = render(
      <ThemeProvider theme={theme}>{Home()}</ThemeProvider>,
    );
    expect(
      getByRole("heading", { level: 1, name: /make sense of your money/i }),
    ).toBeInTheDocument();
  });
});
