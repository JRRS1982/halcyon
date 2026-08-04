// src/__tests__/ui/error-boundary.test.tsx
import AppError from "@/app/error";
import NotFound from "@/app/not-found";
import { theme } from "@/lib/theme";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("route error boundary", () => {
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  afterAll(() => consoleError.mockRestore());

  test("offers a retry that re-renders the segment", () => {
    const reset = jest.fn();
    renderit(<AppError error={new Error("boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  test("always leaves a way back into the app", () => {
    renderit(<AppError error={new Error("boom")} reset={jest.fn()} />);

    expect(
      screen.getByRole("link", { name: /back to dashboard/i }),
    ).toHaveAttribute("href", "/dashboard");
  });

  // Next hides the server stack in production; the digest is the only thing a
  // user can quote back, so it has to reach the screen when present.
  test("surfaces the digest when Next provides one", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    renderit(<AppError error={error} reset={jest.fn()} />);

    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  test("omits the reference line when there is no digest", () => {
    renderit(<AppError error={new Error("boom")} reset={jest.fn()} />);
    expect(screen.queryByText(/reference:/i)).not.toBeInTheDocument();
  });

  test("logs the error so it reaches the browser console", () => {
    const error = new Error("boom");
    renderit(<AppError error={error} reset={jest.fn()} />);
    expect(consoleError).toHaveBeenCalledWith("Route error:", error);
  });
});

describe("not found", () => {
  test("explains the 404 and links onward", () => {
    renderit(<NotFound />);

    expect(
      screen.getByRole("heading", { name: /that page doesn't exist/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /go to dashboard/i }),
    ).toHaveAttribute("href", "/dashboard");
  });
});
