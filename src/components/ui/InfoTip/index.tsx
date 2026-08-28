"use client";

import { useEffect, useRef, useState } from "react";
import { Body, Button, Popover, Title } from "./InfoTip.styled";

type Anchor = { top: number; left: number };

/**
 * A small "i" that explains the control beside it.
 *
 * The panel is fixed-position and anchored to the icon's rect at open time, so
 * it survives a scrolling or clipped parent — the reason the sheets do it this
 * way rather than positioning relative to the icon.
 *
 * The same shape exists inline in BudgetSheet and BalanceSheet, which predate
 * this component; they are left alone rather than migrated as a side effect.
 */
export function InfoTip({
  label,
  title,
  body,
}: {
  /** Names what is being explained, for anyone who cannot see the icon. */
  label: string;
  title: string;
  body: string;
}) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!anchor) return;
    const onDown = (e: MouseEvent) => {
      if (!buttonRef.current?.contains(e.target as Node)) setAnchor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAnchor(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor]);

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={anchor !== null}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAnchor((cur) =>
            cur
              ? null
              : {
                  top: r.bottom + 6,
                  // Keep the panel on screen when the icon is near the edge.
                  left: Math.min(r.left, window.innerWidth - 296),
                },
          );
        }}
      >
        i
      </Button>
      {anchor && (
        <Popover role="dialog" style={{ top: anchor.top, left: anchor.left }}>
          <Title>{title}</Title>
          <Body>{body}</Body>
        </Popover>
      )}
    </>
  );
}
