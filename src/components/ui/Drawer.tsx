// src/components/ui/Drawer.tsx
//
// Shared modal-drawer chrome: scrim, sheet, focus trap, and the collapsible
// DrawerSection/Field building blocks. Originally plan-only (PlanDrawer), it
// moved here once the balance sheet's Add-account drawer needed the same
// dialog/scrim/focus-trap pattern rather than carrying its own copy.
"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import styled from "styled-components";
import { RemoveCell } from "@/components/ui/RemoveCell";

const Scrim = styled.div<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(15, 17, 22, 0.22);
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  visibility: ${({ $open }) => ($open ? "visible" : "hidden")};
  transition: opacity 0.2s ease;
  z-index: 40;
`;
// A native <dialog> (chosen over <aside role="dialog"> to satisfy Biome's
// useSemanticElements), but deliberately NEVER opened via showModal()/open — it
// is rendered purely with CSS: `display: flex` overrides the UA `display:none`,
// and `$open` fades/scales it in over the scrim, centred on the page. Don't add
// showModal()/the `open` attribute: that would move it to the top layer + add UA
// backdrop/Esc handling. Open/close is driven by the `open` prop and our own
// Esc/scrim handlers.
const Sheet = styled.dialog<{ $open: boolean }>`
  position: fixed;
  top: 50%;
  left: 50%;
  width: min(460px, 94vw);
  max-height: min(88vh, 720px);
  background: ${({ theme }) => theme.colors.canvas};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  box-shadow: 0 24px 64px rgba(15, 17, 22, 0.22);
  transform: translate(-50%, -50%)
    scale(${({ $open }) => ($open ? "1" : "0.98")});
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  visibility: ${({ $open }) => ($open ? "visible" : "hidden")};
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  z-index: 50;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  /* On a phone the editor is a bottom sheet: full width, slid up from the
     bottom edge where the thumb already is, rather than a desktop dialog
     shrunk to fit. The grab strip above the header carries drag-to-dismiss. */
  @media (max-width: 767px) {
    top: auto;
    bottom: 0;
    left: 0;
    width: 100%;
    max-height: 85dvh;
    border: 0;
    border-top: 1px solid ${({ theme }) => theme.colors.hairline};
    border-radius: ${({ theme }) => theme.rounded.sm}
      ${({ theme }) => theme.rounded.sm} 0 0;
    box-shadow: 0 -16px 48px rgba(15, 17, 22, 0.22);
    transform: translateY(${({ $open }) => ($open ? "0%" : "100%")});
  }
`;

// Grab strip at the top of the phone sheet — the visual affordance for
// drag-to-dismiss, hidden on desktop where the close button does that job.
const GripStrip = styled.div`
  display: none;

  @media (max-width: 767px) {
    display: flex;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing.sm} 0
      ${({ theme }) => theme.spacing.xs};
    touch-action: none;
    cursor: grab;
  }
`;
const Grip = styled.span`
  width: 36px;
  height: 4px;
  border-radius: ${({ theme }) => theme.rounded.full};
  background: ${({ theme }) => theme.colors.hairlineStrong};
`;
const Head = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
`;
const Eyebrow = styled.div`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.dim};
`;
const Title = styled.h2`
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
  font-size: ${({ theme }) => theme.typography.amountXl.size};
  font-weight: ${({ theme }) => theme.typography.amountXl.weight};
  letter-spacing: ${({ theme }) => theme.typography.amountXl.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
`;
const CloseBtn = styled.button`
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
  color: ${({ theme }) => theme.colors.dim};
  padding: 2px 6px;
  border-radius: ${({ theme }) => theme.rounded.sm};
  &:hover { color: ${({ theme }) => theme.colors.ink}; background: ${({ theme }) => theme.colors.canvasSoft}; }
`;
const Body = styled.div`
  flex: 1;
  overflow-y: auto;
`;
const Foot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  background: ${({ theme }) => theme.colors.canvasSoft};

  /* Keep the footer clear of the iPhone home indicator. */
  @media (max-width: 767px) {
    padding-bottom: calc(
      ${({ theme }) => theme.spacing.md} + env(safe-area-inset-bottom)
    );
  }
`;
const Live = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.bodyMuted};
  &::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: ${({ theme }) => theme.rounded.full};
    background: ${({ theme }) => theme.colors.positive};
  }
`;

const SectionWrap = styled.section`
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
`;
const SectionHead = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.bodyMuted};
`;
const SectionBody = styled.div`
  padding: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;
// What a closed section would show if opened ("7% · 0.5% fee"), so collapsed-
// by-default stays honest — a non-default value is visible without a tap.
// Plain body face: these are values, not chrome, inside a mono-caps header.
const SectionSummary = styled.span`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 12px;
  text-transform: none;
  letter-spacing: normal;
  color: ${({ theme }) => theme.colors.body};
  margin-left: auto;
  padding-left: ${({ theme }) => theme.spacing.md};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const SectionMark = styled.span`
  flex: none;
  padding-left: ${({ theme }) => theme.spacing.md};
`;
const FieldWrap = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.body};
`;

export function DrawerSection({
  title,
  defaultOpen = false,
  summary,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  summary?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <SectionWrap>
      <SectionHead
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        {/* aria-hidden: a visual preview only — kept out of the accessible
            name so the button stays "Terms", not "Terms 4% · 1,200/mo"; the
            canonical value is announced inside the section once opened. */}
        {!open && summary ? (
          <SectionSummary aria-hidden="true">{summary}</SectionSummary>
        ) : null}
        <SectionMark aria-hidden="true">{open ? "−" : "+"}</SectionMark>
      </SectionHead>
      {open ? <SectionBody>{children}</SectionBody> : null}
    </SectionWrap>
  );
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  /** Set for a checkbox: a label that also wraps other controls claims their clicks. */
  htmlFor?: string;
  children: ReactNode;
}) {
  if (htmlFor) {
    return (
      <FieldWrap as="div">
        <label htmlFor={htmlFor}>{label}</label>
        {children}
      </FieldWrap>
    );
  }
  return (
    <FieldWrap>
      {label}
      {children}
    </FieldWrap>
  );
}

export function Drawer({
  open,
  eyebrow,
  title,
  onClose,
  onRemove,
  removeConfirmLabel,
  footer,
  children,
}: {
  open: boolean;
  eyebrow?: string;
  title: string;
  onClose: () => void;
  onRemove?: () => Promise<void> | void;
  removeConfirmLabel?: string;
  /**
   * Replaces the footer's default contents. The plan's rows leave this unset
   * and get the remove control; the balance sheet's Add drawer supplies
   * Cancel/Add, because a draft has nothing to remove yet.
   */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // `onClose` is recreated on every parent render, so keep it in a ref and depend
  // the effect only on `open` — otherwise the effect would re-run (and steal
  // focus back to the trigger) on every re-render while the drawer is open.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // While open: Esc closes; Tab is trapped within the sheet; body scroll is
  // locked; focus moves into the sheet. On close, focus returns to the element
  // that opened the drawer (the summary row).
  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !sheet) return;
      const focusables = sheet.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheet?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      trigger?.focus();
    };
  }, [open]);

  // Drag-to-dismiss for the phone sheet: pulling the grab strip down slides
  // the sheet with the finger (transition suspended so it tracks 1:1); past
  // the threshold on release it closes, otherwise it springs back. Scoped to
  // the strip so it never fights the body's own scrolling.
  const dragFrom = useRef<number | null>(null);
  const dragTo = (dy: number) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = "none";
    sheet.style.transform = `translateY(${Math.max(0, dy)}px)`;
  };
  const endDrag = (dy: number) => {
    const sheet = sheetRef.current;
    dragFrom.current = null;
    if (!sheet) return;
    sheet.style.transition = "";
    sheet.style.transform = "";
    if (dy > 90) onCloseRef.current();
  };

  const defaultFooter = (
    <>
      <Live>Changes update your plan instantly</Live>
      {onRemove ? (
        <RemoveCell onConfirm={onRemove} confirmLabel={removeConfirmLabel} />
      ) : null}
    </>
  );

  return (
    <>
      <Scrim
        $open={open}
        data-testid="plan-drawer-scrim"
        onClick={onClose}
        aria-hidden="true"
      />
      <Sheet
        ref={sheetRef}
        $open={open}
        aria-labelledby={titleId}
        aria-modal={open || undefined}
        aria-hidden={!open}
        tabIndex={-1}
      >
        {open ? (
          <>
            <GripStrip
              data-testid="plan-drawer-grip"
              onPointerDown={(e) => {
                dragFrom.current = e.clientY;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (dragFrom.current === null) return;
                dragTo(e.clientY - dragFrom.current);
              }}
              onPointerUp={(e) => {
                if (dragFrom.current === null) return;
                endDrag(e.clientY - dragFrom.current);
              }}
              onPointerCancel={() => endDrag(0)}
            >
              <Grip />
            </GripStrip>
            <Head>
              <div>
                {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
                <Title id={titleId}>{title}</Title>
              </div>
              <CloseBtn type="button" aria-label="Close" onClick={onClose}>
                {"×"}
              </CloseBtn>
            </Head>
            <Body>{children}</Body>
            <Foot>{footer ?? defaultFooter}</Foot>
          </>
        ) : null}
      </Sheet>
    </>
  );
}
