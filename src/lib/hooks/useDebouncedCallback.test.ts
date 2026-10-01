import { act, renderHook } from "@testing-library/react";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("useDebouncedCallback", () => {
  // The bug: one shared timer meant a second call cancelled the first
  // outright, so an edit to one cell silently discarded the edit to another.
  it("keeps calls with different keys independent", () => {
    const fn = jest.fn();
    const { result } = renderHook(() =>
      useDebouncedCallback(fn, 500, (itemId: string) => itemId),
    );

    act(() => result.current("item-a", { value: 1 }));
    act(() => jest.advanceTimersByTime(200));
    act(() => result.current("item-b", { value: 2 }));
    act(() => jest.advanceTimersByTime(500));

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith("item-a", { value: 1 });
    expect(fn).toHaveBeenCalledWith("item-b", { value: 2 });
  });

  // Still coalescing: rapid edits to the SAME cell must collapse to one write
  // carrying the latest value, which is the whole point of the debounce.
  it("coalesces repeated calls with the same key, keeping the last", () => {
    const fn = jest.fn();
    const { result } = renderHook(() =>
      useDebouncedCallback(fn, 500, (itemId: string) => itemId),
    );

    act(() => result.current("item-a", { value: 1 }));
    act(() => jest.advanceTimersByTime(100));
    act(() => result.current("item-a", { value: 2 }));
    act(() => jest.advanceTimersByTime(500));

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("item-a", { value: 2 });
  });

  // Ledger.tsx calls it with a single search string and no keyOf. That must
  // keep collapsing to one call, or every keystroke would fire a search.
  it("coalesces when there is no key argument", () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 300));

    act(() => result.current("ha"));
    act(() => jest.advanceTimersByTime(100));
    act(() => result.current("hal"));
    act(() => jest.advanceTimersByTime(300));

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("hal");
  });

  it("cancels everything pending on unmount", () => {
    const fn = jest.fn();
    const { result, unmount } = renderHook(() =>
      useDebouncedCallback(fn, 500, (itemId: string) => itemId),
    );

    act(() => result.current("item-a", { value: 1 }));
    act(() => result.current("item-b", { value: 2 }));
    unmount();
    act(() => jest.advanceTimersByTime(1000));

    expect(fn).not.toHaveBeenCalled();
  });

  // The realistic regression path: a caller tidies its call site to pass one
  // merged object instead of (id, patch) positionally. Argument count must
  // not be how keys are inferred — `keyOf` is the only thing that decides
  // per-item independence, so this keeps keying correctly regardless of
  // how many arguments the caller happens to pass.
  it("keys per item even when the caller passes one merged object", () => {
    const fn = jest.fn();
    const { result } = renderHook(() =>
      useDebouncedCallback(fn, 500, (arg: { itemId: string }) => arg.itemId),
    );

    act(() => result.current({ itemId: "a", value: 1 }));
    act(() => jest.advanceTimersByTime(200));
    act(() => result.current({ itemId: "b", value: 2 }));
    act(() => jest.advanceTimersByTime(500));

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
