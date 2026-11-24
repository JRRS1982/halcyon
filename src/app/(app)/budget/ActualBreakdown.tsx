"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { shortDate } from "@/lib/date/humanDate";
import { appear } from "@/lib/motion";
import { hoverInk, reach } from "@/lib/pointer";
import {
  type ActualBreakdown as Breakdown,
  getActualBreakdown,
} from "./actions";

// A budget Actual in transactions mode, as a button that opens the
// transactions behind it. View only: the ledger is where they change.
//
// Closes like the sheet's other popovers — a mousedown outside, Esc (focus
// back to the figure), a second click of the figure — and on focus leaving
// it. Portalled and fixed-positioned so the sheet's overflow cannot clip it;
// a page scroll or resize would strand it, so those close it too.

const WIDTH = 380;
const GUTTER = 16;

const Figure = styled.button`
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.primary};
  border-bottom: 1px dashed currentColor;
  cursor: pointer;

  &[aria-expanded="true"] {
    background: ${({ theme }) => theme.colors.hover};
  }

  ${hoverInk}
  ${reach}
`;

const Popover = styled.div`
  ${appear}
  ${({ theme }) => `
    position: fixed;
    z-index: 50;
    display: grid;
    gap: ${theme.spacing.sm};
    background: ${theme.colors.canvas};
    border: 1px solid ${theme.colors.hairlineStrong};
    border-radius: ${theme.rounded.sm};
    box-shadow: rgba(15, 17, 22, 0.12) 0px 6px 16px 0px;
    padding: ${theme.spacing.md};
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    color: ${theme.colors.body};
    text-align: left;
    text-transform: none;
    letter-spacing: normal;

    &:focus { outline: none; }
    &:focus-visible { outline: 2px solid ${theme.colors.focus}; }
  `}
`;

const Title = styled.div`
  ${({ theme }) => `
    font-family: ${theme.typography.bodyMdStrong.family};
    font-weight: ${theme.typography.bodyMdStrong.weight};
    color: ${theme.colors.ink};
  `}
`;

const Muted = styled.div`
  color: ${({ theme }) => theme.colors.dim};
`;

// Room for about eight rows before it scrolls.
const Rows = styled.div`
  max-height: 272px;
  overflow-y: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;

  td {
    padding: 6px 4px;
    vertical-align: top;
    border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  }

  tr:last-child td {
    border-bottom: 0;
  }
`;

const Nowrap = styled.td`
  white-space: nowrap;
`;

const Amount = styled.td<{ $negative: boolean }>`
  text-align: right;
  white-space: nowrap;
  color: ${({ $negative, theme }) =>
    $negative ? theme.colors.negative : theme.colors.positive};
`;

// The ledger's own mark for a category an import suggested and nobody has
// approved yet.
const Pencil = styled.span`
  ${({ theme }) => `
    margin-left: ${theme.spacing.xs};
    padding: 0 4px;
    border: 1px dashed ${theme.colors.hairlineStrong};
    border-radius: ${theme.rounded.sm};
    font-size: 11px;
    font-style: italic;
    color: ${theme.colors.dim};
  `}
`;

const Side = styled.span`
  display: block;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.dim};
`;

const Foot = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing.sm};
    align-items: baseline;
    justify-content: space-between;
    padding-top: ${theme.spacing.sm};
    border-top: 1px solid ${theme.colors.hairline};

    b { color: ${theme.colors.ink}; }
  `}
`;

const LedgerLink = styled(Link)`
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;

  ${hoverInk}
`;

type Load =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; breakdown: Breakdown };

type Place = { left: number; width: number } & (
  | { top: number }
  | { bottom: number }
);

// Under the figure, right-aligned to it, unless it sits low on the screen —
// then above, so the list is not pushed off the bottom.
function placeBeside(rect: DOMRect): Place {
  const width = Math.min(WIDTH, window.innerWidth - GUTTER * 2);
  const left = Math.max(
    GUTTER,
    Math.min(rect.right - width, window.innerWidth - width - GUTTER),
  );
  return rect.bottom > window.innerHeight * 0.6
    ? { left, width, bottom: window.innerHeight - rect.top + 6 }
    : { left, width, top: rect.bottom + 6 };
}

function countLine(breakdown: Breakdown): string {
  const total = breakdown.lines.length;
  if (total === 0) return "No transactions";
  const pencilled = breakdown.lines.filter((line) => line.isPencilled).length;
  const count = `${total} transaction${total === 1 ? "" : "s"}`;
  return pencilled > 0 ? `${count} · ${pencilled} still in pencil` : count;
}

export function ActualBreakdown({
  itemId,
  label,
  context,
  actual,
  budget,
  fmtAmount,
  fmtSigned,
  onFocus,
}: {
  itemId: string;
  /** The row's name, as the sheet shows it. */
  label: string;
  /** Where the row sits: "Expenses · Variable", "Transfers and saving". */
  context: string;
  actual: number;
  budget: number;
  fmtAmount: (n: number) => string;
  fmtSigned: (n: number) => string;
  onFocus?: () => void;
}) {
  const [place, setPlace] = useState<Place | null>(null);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const figureRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  // Only the latest open's answer is shown: a slow reply to an earlier open
  // must not land on a later one.
  const requestRef = useRef(0);
  const isOpen = place !== null;

  const close = useCallback(() => setPlace(null), []);

  const toggle = () => {
    if (isOpen) {
      close();
      return;
    }
    const figure = figureRef.current;
    if (!figure) return;
    setPlace(placeBeside(figure.getBoundingClientRect()));
    setLoad({ status: "loading" });
    const request = ++requestRef.current;
    getActualBreakdown({ itemId }).then(
      (breakdown) => {
        if (request === requestRef.current) {
          setLoad({ status: "ready", breakdown });
        }
      },
      () => {
        if (request === requestRef.current) setLoad({ status: "failed" });
      },
    );
  };

  useEffect(() => {
    if (isOpen) popoverRef.current?.focus({ preventScroll: true });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (popoverRef.current?.contains(target) ||
        figureRef.current?.contains(target));
    // The figure itself is left to its own click, which toggles.
    const onMouseDown = (e: MouseEvent) => {
      if (!inside(e.target)) close();
    };
    const onScroll = (e: Event) => {
      if (!popoverRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen, close]);

  const today = new Date();
  const popover = place && (
    <Popover
      ref={popoverRef}
      role="dialog"
      aria-label={`${label} transactions`}
      tabIndex={-1}
      style={place}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        close();
        figureRef.current?.focus();
      }}
      // Focus moving somewhere else on the page closes it. A null
      // relatedTarget (focus left the page, or a click on nothing focusable)
      // is left to the mousedown listener, so webkit — which does not focus a
      // clicked button — still toggles on the figure.
      onBlur={(e) => {
        const next = e.relatedTarget;
        if (!next) return;
        if (popoverRef.current?.contains(next)) return;
        if (figureRef.current?.contains(next)) return;
        close();
      }}
    >
      <div>
        <Title>{label}</Title>
        <Muted>
          {context}
          {load.status === "ready" && ` · ${countLine(load.breakdown)}`}
        </Muted>
      </div>
      {load.status === "loading" && <Muted>Loading…</Muted>}
      {load.status === "failed" && (
        <Muted>Couldn't load these transactions. Try again.</Muted>
      )}
      {load.status === "ready" && load.breakdown.lines.length > 0 && (
        <Rows>
          <Table>
            <tbody>
              {load.breakdown.lines.map((line) => (
                <tr key={line.id}>
                  <Nowrap>{shortDate(line.date, today)}</Nowrap>
                  <td>{line.accountName}</td>
                  <td>
                    {line.description}
                    {line.isPencilled && (
                      <Pencil title="Category suggested, not yet approved">
                        pencil
                      </Pencil>
                    )}
                    {line.recordedOn && (
                      <Side>Recorded on {line.recordedOn}'s side</Side>
                    )}
                  </td>
                  <Amount $negative={line.amount < 0}>
                    {fmtSigned(line.amount)}
                  </Amount>
                </tr>
              ))}
            </tbody>
          </Table>
        </Rows>
      )}
      {load.status === "ready" && (
        <Foot>
          <span>
            Actual <b>{fmtAmount(load.breakdown.actual)}</b> of{" "}
            {fmtAmount(budget)} budgeted
          </span>
          {load.breakdown.ledgerHref && (
            <LedgerLink href={load.breakdown.ledgerHref}>
              Open in ledger <span aria-hidden>→</span>
            </LedgerLink>
          )}
        </Foot>
      )}
    </Popover>
  );

  return (
    <>
      <Figure
        ref={figureRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`${label} Actual ${fmtAmount(actual)}: show transactions`}
        onClick={toggle}
        onFocus={onFocus}
      >
        {fmtAmount(actual)}
      </Figure>
      {popover && createPortal(popover, document.body)}
    </>
  );
}
