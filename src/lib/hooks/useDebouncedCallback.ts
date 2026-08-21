"use client";

import { useCallback, useEffect, useRef } from "react";

// Calls with a single argument (e.g. a search string) share this key, so they
// keep coalescing into one pending write — the pre-existing, correct
// behaviour for that shape of call.
const DEFAULT_KEY = "__default__";

// Returns a stable callback that delays invoking `fn` until `delay` ms have
// passed without another call sharing the same key. A call made with more
// than one argument is keyed by its first argument, so per-item calls (e.g.
// `debouncedUpdate(itemId, patch)`) debounce independently per item instead
// of cancelling each other's pending writes. A call made with zero or one
// argument shares a single key and continues to coalesce into the latest
// call, matching the previous single-timer behaviour.
// The latest `fn` reference is always used. Cancels every in-flight timer on
// unmount.
//
// biome-ignore lint/suspicious/noExplicitAny: generic callback type
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const timeoutsRef = useRef(new Map<unknown, ReturnType<typeof setTimeout>>());
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    return () => {
      for (const timeout of timeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      timeoutsRef.current.clear();
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      const key = args.length > 1 ? args[0] : DEFAULT_KEY;
      const existing = timeoutsRef.current.get(key);
      if (existing) clearTimeout(existing);
      timeoutsRef.current.set(
        key,
        setTimeout(() => {
          timeoutsRef.current.delete(key);
          fnRef.current(...args);
        }, delay),
      );
    },
    [delay],
  );
}
