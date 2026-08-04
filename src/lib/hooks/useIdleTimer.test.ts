import type { SessionTimeoutConfig } from "@/lib/auth/sessionTimeout";
import { act, renderHook } from "@testing-library/react";
import { useIdleTimer } from "./useIdleTimer";

const config: SessionTimeoutConfig = {
  idleMs: 10_000,
  warnMs: 3_000,
  absoluteMs: 60_000,
};

const advance = (ms: number) => {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
};

const fireActivity = () => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown"));
  });
};

// jsdom ships no BroadcastChannel, so the hook's `typeof` guard means every
// other test here runs the no-channel path. This double covers the other one.
class TestBroadcastChannel {
  static open: TestBroadcastChannel[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;

  constructor(readonly name: string) {
    TestBroadcastChannel.open.push(this);
  }

  postMessage(data: unknown) {
    for (const channel of TestBroadcastChannel.open) {
      if (channel !== this && channel.name === this.name)
        channel.onmessage?.({ data });
    }
  }

  close() {
    TestBroadcastChannel.open = TestBroadcastChannel.open.filter(
      (channel) => channel !== this,
    );
  }
}

const withBroadcastChannel = (): void => {
  TestBroadcastChannel.open = [];
  Object.defineProperty(globalThis, "BroadcastChannel", {
    value: TestBroadcastChannel,
    configurable: true,
    writable: true,
  });
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  Reflect.deleteProperty(globalThis, "BroadcastChannel");
});

describe("useIdleTimer", () => {
  it("starts quiet", () => {
    const { result } = renderHook(() =>
      useIdleTimer({ onExpire: jest.fn(), config }),
    );

    expect(result.current.warning).toBe(false);
    expect(result.current.secondsRemaining).toBe(0);
  });

  it("stays quiet while remaining time is above the warning threshold", () => {
    const { result } = renderHook(() =>
      useIdleTimer({ onExpire: jest.fn(), config }),
    );

    advance(6_000);

    expect(result.current.warning).toBe(false);
  });

  it("warns with a countdown as the idle window closes", () => {
    const { result } = renderHook(() =>
      useIdleTimer({ onExpire: jest.fn(), config }),
    );

    advance(7_000);
    expect(result.current).toMatchObject({
      warning: true,
      secondsRemaining: 3,
    });

    advance(1_000);
    expect(result.current).toMatchObject({
      warning: true,
      secondsRemaining: 2,
    });
  });

  it("calls onExpire once when the window closes", () => {
    const onExpire = jest.fn();
    renderHook(() => useIdleTimer({ onExpire, config }));

    advance(10_000);
    expect(onExpire).toHaveBeenCalledTimes(1);

    advance(30_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("expires rather than resuming mid-countdown after a long suspend", () => {
    const onExpire = jest.fn();
    const { result } = renderHook(() => useIdleTimer({ onExpire, config }));

    // One jump past the whole window, as a sleeping laptop produces.
    advance(60_000);

    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(result.current.warning).toBe(false);
  });

  it("resets the countdown on user activity", () => {
    const onExpire = jest.fn();
    const { result } = renderHook(() => useIdleTimer({ onExpire, config }));

    advance(5_000);
    fireActivity();
    advance(6_000);

    expect(result.current.warning).toBe(false);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("ignores activity once the warning is up, so only an explicit choice extends", () => {
    const { result } = renderHook(() =>
      useIdleTimer({ onExpire: jest.fn(), config }),
    );

    advance(7_000);
    fireActivity();

    expect(result.current.warning).toBe(true);
  });

  it("dismisses the warning when the session is extended", () => {
    const onExpire = jest.fn();
    const { result } = renderHook(() => useIdleTimer({ onExpire, config }));

    advance(7_000);
    act(() => {
      result.current.extend();
    });

    expect(result.current.warning).toBe(false);

    advance(6_000);
    expect(result.current.warning).toBe(false);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("adopts activity broadcast by another tab", () => {
    withBroadcastChannel();
    const onExpire = jest.fn();
    const { result } = renderHook(() => useIdleTimer({ onExpire, config }));
    const otherTab = new BroadcastChannel("bm-idle-activity");

    advance(5_000);
    act(() => {
      otherTab.postMessage(Date.now());
    });
    advance(6_000);
    otherTab.close();

    expect(result.current.warning).toBe(false);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("tells other tabs when this one is still in use", () => {
    withBroadcastChannel();
    const otherTab = new BroadcastChannel("bm-idle-activity");
    const received: unknown[] = [];
    otherTab.onmessage = (event) => received.push(event.data);

    renderHook(() => useIdleTimer({ onExpire: jest.fn(), config }));
    advance(5_000);
    fireActivity();
    otherTab.close();

    expect(received).toEqual([Date.now()]);
  });

  it("stops ticking once unmounted", () => {
    const onExpire = jest.fn();
    const { unmount } = renderHook(() => useIdleTimer({ onExpire, config }));

    unmount();
    advance(30_000);

    expect(onExpire).not.toHaveBeenCalled();
  });
});
