// src/__tests__/marketing/home-route.test.tsx

import { render } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import Home from "@/app/(marketing)/page";
import { theme } from "@/lib/theme";

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
