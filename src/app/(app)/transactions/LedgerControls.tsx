// The ledger's controls card: everything that acts on the table, inside one
// bounded surface so the table below reads as a separate thing.
//
// The card is contextual. With nothing selected it filters and searches. With
// a selection, the search box *becomes* the categorize box — once rows are
// selected you have already found them, so the input's job changes — and the
// selection-only actions appear rather than sitting greyed out waiting.
//
// This replaced a permanently-mounted, mostly-inert bulk bar that existed only
// to stop the table jumping when it mounted. A card that is always present
// solves that jump without the dead row.
"use client";

import type { ReactNode, RefObject } from "react";
import styled from "styled-components";
import type { ActiveFilter } from "@/lib/transactions/activeFilters";

const Card = styled.section`
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`;

// Holds the search box and the categorize box in turn. Fixed flex so the card
// does not resize as one replaces the other.
const Slot = styled.div`
  flex: 1;
  min-width: 200px;
`;

const SelectionCount = styled.span`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.ink};
  white-space: nowrap;
`;

const FilterButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
`;

// The count of active filters. The drawer hides its own state once closed, so
// without this the only clue the ledger is filtered would be the chips below.
const FilterBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: ${({ theme }) => theme.rounded.full};
  background: ${({ theme }) => theme.colors.ink};
  color: ${({ theme }) => theme.colors.canvas};
  font-size: 11px;
  line-height: 1;
`;

const Search = styled.input`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const ChipRow = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Chip = styled.li`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.full};
  background: ${({ theme }) => theme.colors.canvasSoft};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.body};
`;

const ChipRemove = styled.button`
  border: 0;
  background: transparent;
  padding: 0 2px;
  line-height: 1;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.dim};
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.ink};
  }
`;

// Destructive per DESIGN.md: outline with red text, never one-click.
const DangerButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.negative};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  cursor: pointer;
  white-space: nowrap;
`;

const GhostButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.lg};
  border: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  cursor: pointer;
  white-space: nowrap;
`;

export function LedgerControls({
  search,
  searchRef,
  onSearch,
  chips,
  onClearFilter,
  onOpenFilters,
  selectedCount,
  onClearSelection,
  onDelete,
  categorizer,
}: {
  search: string;
  searchRef: RefObject<HTMLInputElement | null>;
  onSearch: (value: string) => void;
  chips: ActiveFilter[];
  onClearFilter: (chip: ActiveFilter) => void;
  onOpenFilters: () => void;
  selectedCount: number;
  onClearSelection: () => void;
  onDelete: () => void;
  /** The bulk CategoryCombobox, rendered into the search box's slot. */
  categorizer: ReactNode;
}) {
  const hasSelection = selectedCount > 0;

  return (
    <Card aria-label="Ledger controls">
      <Row>
        {hasSelection ? (
          <SelectionCount>{selectedCount} selected</SelectionCount>
        ) : (
          <FilterButton
            type="button"
            onClick={onOpenFilters}
            aria-label={
              chips.length > 0 ? `Filters (${chips.length} active)` : "Filters"
            }
          >
            Filters
            {/* aria-hidden: the count is already in the button's label, and
                reading it twice would announce "Filters 2 active 2". */}
            {chips.length > 0 ? (
              <FilterBadge aria-hidden="true">{chips.length}</FilterBadge>
            ) : null}
          </FilterButton>
        )}

        {/* One slot, two jobs. The search input is kept mounted underneath
            rather than swapped out, so a half-typed query survives a stray
            row click and comes back when the selection clears. */}
        <Slot>
          <div hidden={!hasSelection}>{categorizer}</div>
          <Search
            hidden={hasSelection}
            ref={searchRef}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search description…"
          />
        </Slot>

        {hasSelection ? (
          <>
            <DangerButton type="button" onClick={onDelete}>
              Delete…
            </DangerButton>
            <GhostButton type="button" onClick={onClearSelection}>
              Clear
            </GhostButton>
          </>
        ) : null}
      </Row>

      {chips.length > 0 && (
        <ChipRow aria-label="Active filters">
          {chips.map((chip) => (
            <Chip key={chip.key}>
              {chip.label}
              <ChipRemove
                type="button"
                aria-label={`Remove filter: ${chip.label}`}
                onClick={() => onClearFilter(chip)}
              >
                {"×"}
              </ChipRemove>
            </Chip>
          ))}
        </ChipRow>
      )}
    </Card>
  );
}
