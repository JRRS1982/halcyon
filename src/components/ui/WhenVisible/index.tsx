"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Renders `children` only once the placeholder has come near the viewport.
 *
 * The dashboard stacks up to ten charts. Recharts builds scales and a full SVG
 * per instance, so mounting all of them on load costs main-thread time for
 * charts the user may never scroll to. Once shown, it stays shown — this
 * defers first paint, it doesn't unmount on scroll-away.
 *
 * Falls back to rendering immediately where IntersectionObserver is missing
 * (jsdom included), so tests and old browsers see the real content.
 */
export function WhenVisible({
  children,
  fallback,
  rootMargin = "200px",
}: {
  children: ReactNode;
  fallback: ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return <div ref={ref}>{visible ? children : fallback}</div>;
}
