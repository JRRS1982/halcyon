// src/__tests__/marketing/home-route.test.tsx
import Home from "@/app/page";
import { theme } from "@/lib/theme";
import { render } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const getUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
const redirect = jest.fn();
jest.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

describe("Home route", () => {
  beforeEach(() => {
    getUser.mockReset();
    redirect.mockReset();
  });

  test("renders the landing page for signed-out visitors", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const ui = await Home();
    const { getByRole } = render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
    expect(getByRole("heading", { level: 1, name: /make sense of your money/i })).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  test("redirects signed-in visitors to /dashboard", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    await Home();
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
