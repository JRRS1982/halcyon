"use client";

import { useCallback, useEffect, useRef } from "react";

// Returns a stable callback that delays invoking `fn` until `delay` ms have
// passed without further calls. The latest `fn` reference is always used.
// Cancels in-flight timers on unmount.
//
// biome-ignore lint/suspicious/noExplicitAny: generic callback type
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay],
  );
}
