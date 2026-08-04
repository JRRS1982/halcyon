"use client";

import {
  type IdleState,
  SESSION_TIMEOUT,
  type SessionTimeoutConfig,
  idleStateAt,
} from "@/lib/auth/sessionTimeout";
import { useCallback, useEffect, useRef, useState } from "react";

// What counts as "the user is still here". Deliberately excludes mousemove: a
// nudged desk should not hold a finance session open overnight.
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "scroll",
  "touchstart",
] as const;

// Open tabs share one activity clock, so working in one tab does not let
// another time out underneath you.
const ACTIVITY_CHANNEL = "bm-idle-activity";

const TICK_MS = 1000;

type IdleTimer = {
  warning: boolean;
  // Whole seconds until sign-out. Zero unless `warning` is true.
  secondsRemaining: number;
  extend: () => void;
};

const isSameState = (a: IdleState, b: IdleState): boolean =>
  a.phase === b.phase &&
  (a.phase !== "warning" ||
    b.phase !== "warning" ||
    a.secondsRemaining === b.secondsRemaining);

// Watches for user inactivity and reports when the idle window is about to
// close. All the arithmetic lives in `idleStateAt`; this is the shell that
// wires it to timers, DOM events and other tabs. The tick re-derives everything
// from wall-clock timestamps rather than counting elapsed ticks, so a suspended
// laptop wakes up knowing the session already lapsed.
export function useIdleTimer({
  onExpire,
  config = SESSION_TIMEOUT,
}: {
  onExpire: () => void;
  config?: SessionTimeoutConfig;
}): IdleTimer {
  const [state, setState] = useState<IdleState>({ phase: "active" });
  const lastActivityRef = useRef(Date.now());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const recordActivity = useCallback((at: number, broadcast: boolean) => {
    lastActivityRef.current = at;
    setState((prev) => (prev.phase === "active" ? prev : { phase: "active" }));
    if (broadcast) channelRef.current?.postMessage(at);
  }, []);

  useEffect(() => {
    const tick = () => {
      const next = idleStateAt(lastActivityRef.current, Date.now(), config);
      setState((prev) => (isSameState(prev, next) ? prev : next));
    };

    tick();
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [config]);

  useEffect(() => {
    if (state.phase !== "expired" || hasExpiredRef.current) return;
    hasExpiredRef.current = true;
    onExpireRef.current();
  }, [state.phase]);

  useEffect(() => {
    const handleActivity = () => {
      const now = Date.now();
      // Doubles as the throttle: activity within a second of the last recorded
      // one changes nothing.
      if (now - lastActivityRef.current < TICK_MS) return;
      // Once the warning is up, only the explicit "stay signed in" action
      // extends the session. That path also refreshes the server-side activity
      // cookie, so the two clocks stay in step; a stray scroll would move only
      // this one.
      if (idleStateAt(lastActivityRef.current, now, config).phase !== "active")
        return;
      recordActivity(now, true);
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
    };
  }, [config, recordActivity]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(ACTIVITY_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data !== "number") return;
      if (event.data <= lastActivityRef.current) return;
      // Adopted, not rebroadcast — otherwise two tabs echo each other forever.
      recordActivity(event.data, false);
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [recordActivity]);

  const extend = useCallback(
    () => recordActivity(Date.now(), true),
    [recordActivity],
  );

  return {
    warning: state.phase === "warning",
    secondsRemaining: state.phase === "warning" ? state.secondsRemaining : 0,
    extend,
  };
}
