import type { SessionTimeoutConfig } from "@/lib/auth/sessionTimeout";
import { theme } from "@/lib/theme";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { IdleTimeout } from ".";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const signOutIdle = jest.fn();
jest.mock("@/app/actions", () => ({
  signOutIdle: () => signOutIdle(),
}));

const config: SessionTimeoutConfig = {
  idleMs: 10_000,
  warnMs: 3_000,
  absoluteMs: 60_000,
};

const renderIt = () =>
  render(
    <ThemeProvider theme={theme}>
      <IdleTimeout config={config} />
    </ThemeProvider>,
  );

const advance = (ms: number) => {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
};

const dialog = () => screen.getByRole("alertdialog", { hidden: true });

// jsdom renders <dialog> but implements neither showModal() nor close(). It does
// reflect the `open` attribute into `.open`, which is the whole of what the
// component reads, so driving the attribute is a faithful enough stand-in.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  jest.useFakeTimers();
  refresh.mockClear();
  signOutIdle.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("IdleTimeout", () => {
  it("stays shut while the user is active", () => {
    renderIt();

    advance(6_000);

    expect(dialog()).not.toHaveAttribute("open");
  });

  it("opens with a countdown as the idle window closes", () => {
    renderIt();

    advance(7_000);

    expect(dialog()).toHaveAttribute("open");
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      /sign you out in 3 seconds/i,
    );
  });

  it("counts down while open", () => {
    renderIt();

    advance(8_000);

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      /sign you out in 2 seconds/i,
    );
  });

  it("signs out when the window closes", () => {
    renderIt();

    advance(10_000);

    expect(signOutIdle).toHaveBeenCalledTimes(1);
  });

  it("closes and resets the server clock when the user stays signed in", () => {
    renderIt();

    advance(7_000);
    fireEvent.click(screen.getByRole("button", { name: /stay signed in/i }));

    expect(dialog()).not.toHaveAttribute("open");
    expect(refresh).toHaveBeenCalledTimes(1);

    advance(6_000);
    expect(signOutIdle).not.toHaveBeenCalled();
  });

  it("signs out on request", () => {
    renderIt();

    advance(7_000);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(signOutIdle).toHaveBeenCalledTimes(1);
  });

  it("does not let Escape dismiss the warning", () => {
    renderIt();
    advance(7_000);

    // Escape reaches a modal <dialog> as a cancelable "cancel" event; the
    // component must refuse it rather than let the clock run on unattended.
    const cancel = new Event("cancel", { cancelable: true, bubbles: false });
    fireEvent(dialog(), cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog()).toHaveAttribute("open");
  });
});
