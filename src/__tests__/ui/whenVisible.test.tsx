// src/__tests__/ui/whenVisible.test.tsx
import { WhenVisible } from "@/components/ui/WhenVisible";
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

const subject = (
  <WhenVisible fallback={<span>placeholder</span>}>
    <span>chart</span>
  </WhenVisible>
);

describe("WhenVisible", () => {
  const original = global.IntersectionObserver;
  afterEach(() => {
    global.IntersectionObserver = original;
  });

  /**
   * The bug this guards: `visible` was seeded from
   * `typeof IntersectionObserver === "undefined"`, which is true on the server
   * and false in a browser. The server therefore rendered the children while
   * the client's first render showed the fallback, and React reported a
   * hydration mismatch on every dashboard load.
   *
   * Server-rendered markup has to match what the client renders *before*
   * effects run, so this compares exactly those two.
   */
  test("server markup matches the client's first paint", () => {
    // Present, as it is in a real browser — and absent during renderToString,
    // which is the asymmetry that caused the mismatch.
    global.IntersectionObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof IntersectionObserver;

    const serverHtml = renderToString(subject);

    expect(serverHtml).toContain("placeholder");
    expect(serverHtml).not.toContain("chart");
  });

  test("shows the fallback until the element is observed as visible", () => {
    global.IntersectionObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof IntersectionObserver;

    render(subject);

    expect(screen.getByText("placeholder")).toBeInTheDocument();
    expect(screen.queryByText("chart")).not.toBeInTheDocument();
  });

  test("reveals the content once the observer reports an intersection", () => {
    let fire: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
    global.IntersectionObserver = class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        fire = cb;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof IntersectionObserver;

    render(subject);
    expect(screen.queryByText("chart")).not.toBeInTheDocument();

    // The observer calls back outside React's event system, so the resulting
    // state update needs flushing explicitly.
    act(() => fire?.([{ isIntersecting: true }]));
    expect(screen.getByText("chart")).toBeInTheDocument();
  });

  // Without this, an environment lacking the API would hide the content
  // permanently rather than degrading to "just show it".
  test("falls back to showing the content where the API is missing", () => {
    // @ts-expect-error deliberately removing a browser global
    global.IntersectionObserver = undefined;

    render(subject);

    expect(screen.getByText("chart")).toBeInTheDocument();
  });
});
