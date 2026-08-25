"use client";

import { useCallback, useEffect, useRef } from "react";

// Calls that don't supply `keyOf` share this key, so they keep coalescing
// into one pending write — the pre-existing, correct behaviour for a call
// like Ledger's single search value. A Symbol so it can never collide with
// a real key `keyOf` returns.
const DEFAULT_KEY = Symbol("useDebouncedCallback.defaultKey");

// Returns a stable callback that delays invoking `fn` until `delay` ms have
// passed without another call sharing the same key. Pass `keyOf` to
// identify which pending edit a call belongs to (e.g. an item id), so
// per-item calls debounce independently instead of cancelling each other's
// pending writes. Without `keyOf`, every call shares one key and continues
// to coalesce into the latest call — the original single-timer behaviour.
// The latest `fn` reference is always used. Cancels every in-flight timer on
// unmount.
//
// biome-ignore lint/suspicious/noExplicitAny: generic callback type
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
  keyOf?: (...args: Parameters<T>) => string | number,
): (...args: Parameters<T>) => void {
  const timeoutsRef = useRef(
    new Map<
      string | number | typeof DEFAULT_KEY,
      ReturnType<typeof setTimeout>
    >(),
  );
  const fnRef = useRef(fn);
  const keyOfRef = useRef(keyOf);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    keyOfRef.current = keyOf;
  }, [keyOf]);

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
      const key = keyOfRef.current ? keyOfRef.current(...args) : DEFAULT_KEY;
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
