"use client";

import type { ReactNode } from "react";
import {
  Bar,
  HeaderLeft,
  HeaderRow,
  Panel,
  PanelGrid,
  PanelStack,
  SheetBox,
  SheetLine,
  Shell,
  ToolbarRow,
} from "./Skeleton.styled";

const px = (value: number | string) =>
  typeof value === "number" ? `${value}px` : value;

/** A single placeholder bar. Decorative — the page announces its own state. */
export function Skeleton({
  width = "100%",
  height = 14,
}: {
  width?: number | string;
  height?: number | string;
}) {
  return <Bar $width={px(width)} $height={px(height)} aria-hidden="true" />;
}

/**
 * Wraps a route's placeholder content. `role="status"` plus the visible
 * "Loading <label>" text means a screen reader hears the wait rather than
 * silence, and the shell holds the same footprint as the real page.
 */
export function SkeletonPage({
  label,
  maxWidth = "1240px",
  children,
}: {
  label: string;
  maxWidth?: string;
  children: ReactNode;
}) {
  // `<output>` carries an implicit role="status" live region, so assistive tech
  // announces the wait without a redundant role attribute.
  return (
    <Shell as="output" $maxWidth={maxWidth} aria-busy="true">
      <VisuallyHiddenLabel>Loading {label}</VisuallyHiddenLabel>
      {children}
    </Shell>
  );
}

// The pip in the header carries the visible cue; this is for assistive tech,
// which shouldn't have to infer "loading" from a grid of grey rectangles.
function VisuallyHiddenLabel({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** Eyebrow + title + lead standing in for PageHeader, with an optional pip. */
export function SkeletonHeader({ actions }: { actions?: ReactNode }) {
  return (
    <HeaderRow>
      <HeaderLeft>
        <Skeleton width={92} height={11} />
        <Skeleton width={220} height={28} />
        <Skeleton width={320} height={14} />
      </HeaderLeft>
      {actions}
    </HeaderRow>
  );
}

/** The chip row above a sheet. */
export function SkeletonToolbar({ chips = 6 }: { chips?: number }) {
  return (
    <ToolbarRow>
      {Array.from({ length: chips }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative placeholder; never reorders, holds no state.
        <Skeleton key={i} width={i % 3 === 0 ? 64 : 108} height={30} />
      ))}
    </ToolbarRow>
  );
}

/** Column header, a dark section band, then item rows and a totals row. */
export function SkeletonSheet({ rows = 6 }: { rows?: number }) {
  return (
    <SheetBox>
      <SheetLine $tone="head">
        <Skeleton width={80} height={12} />
        <Skeleton width={56} height={12} />
        <Skeleton width={56} height={12} />
      </SheetLine>
      <SheetLine $tone="band">
        <Skeleton width={72} height={12} />
        <Skeleton width={64} height={12} />
        <Skeleton width={64} height={12} />
      </SheetLine>
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative placeholder; never reorders, holds no state.
        <SheetLine key={i} $tone="row">
          <Skeleton width={`${45 + ((i * 13) % 35)}%`} height={14} />
          <Skeleton width={64} height={14} />
          <Skeleton width={64} height={14} />
        </SheetLine>
      ))}
    </SheetBox>
  );
}

/** A bordered panel with a title, lead and a body block (chart or form). */
export function SkeletonPanel({ bodyHeight = 240 }: { bodyHeight?: number }) {
  return (
    <Panel>
      <Skeleton width={140} height={12} />
      <Skeleton width="70%" height={14} />
      <Skeleton height={bodyHeight} />
    </Panel>
  );
}

export { PanelGrid as SkeletonPanelGrid, PanelStack as SkeletonPanelStack };
