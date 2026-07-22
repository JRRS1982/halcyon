// src/app/plan/EventsTable.tsx
"use client";

import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { NumberCell, SelectCell, TextCell } from "./EditableCell";
import { DrawerSection, Field } from "./PlanDrawer";
import { AddRowButton } from "./RowControls";
import { SummaryList, SummaryRow } from "./SummaryRow";
import { createPlanEvent, updatePlanEvent } from "./actions";
import type {
  EventDirection,
  EventKind,
  SerializedPlanEvent,
} from "./serialized";

const DIRECTIONS: EventDirection[] = ["INFLOW", "OUTFLOW"];
const EVENT_KINDS: EventKind[] = ["MANUAL", "PROPERTY_SALE"];

type PlanProperty = { id: string; label: string };

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Empty = styled.p`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
  margin: ${({ theme }) => theme.spacing.sm} 0;
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
`;
const Hint = styled.p`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 12px;
  margin: 0;
`;
// A minimal id→label picker: SelectCell only ever shows its raw value as both
// the option value and its text, which is fine for the MANUAL/PROPERTY_SALE
// toggle but not for a property, whose id isn't fit for display.
const PropertySelect = styled.select`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.xs};
  font-size: 13px;
`;

export function EventFields({
  event,
  properties,
}: {
  event: SerializedPlanEvent;
  properties: PlanProperty[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const save = async (next: SerializedPlanEvent) => {
    setError(null);
    try {
      await updatePlanEvent({
        eventId: next.id,
        label: next.label,
        age: next.age,
        direction: next.direction,
        amount: next.amount,
        kind: next.kind,
        assetId: next.assetId,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      throw e;
    }
  };

  const isSale = event.kind === "PROPERTY_SALE";
  // Only offer the Property sale toggle when there's a property to sell —
  // otherwise switching to it would auto-default assetId to null, which
  // fails server validation and reverts the dropdown (see review fix).
  const kindOptions: EventKind[] =
    properties.length > 0 ? EVENT_KINDS : ["MANUAL"];

  return (
    <>
      {error ? <Err>{error}</Err> : null}
      <DrawerSection title="Basics" defaultOpen>
        <Field label="Label">
          <TextCell
            value={event.label}
            onCommit={(v) => save({ ...event, label: v })}
          />
        </Field>
        <Field label="Age">
          <NumberCell
            value={event.age}
            onCommit={(v) => save({ ...event, age: v ?? event.age })}
          />
        </Field>
        <Field label="Type">
          <SelectCell
            value={event.kind}
            options={kindOptions}
            onCommit={(v) =>
              save({
                ...event,
                kind: v,
                // Switching to a sale needs a non-null assetId to pass
                // server validation, so default to the first property when
                // none is picked yet; the picker below lets it be changed.
                assetId:
                  v === "MANUAL"
                    ? null
                    : (event.assetId ?? properties[0]?.id ?? null),
              })
            }
          />
        </Field>
        {isSale ? (
          properties.length > 0 ? (
            <Field label="Property">
              <PropertySelect
                value={event.assetId ?? ""}
                onChange={(e) => save({ ...event, assetId: e.target.value })}
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </PropertySelect>
            </Field>
          ) : (
            <Hint>Add a property first</Hint>
          )
        ) : (
          <>
            <Field label="Direction">
              <SelectCell
                value={event.direction}
                options={DIRECTIONS}
                onCommit={(v) => save({ ...event, direction: v })}
              />
            </Field>
            <Field label="Amount">
              <NumberCell
                value={event.amount}
                onCommit={(v) => save({ ...event, amount: v ?? event.amount })}
              />
            </Field>
          </>
        )}
      </DrawerSection>
    </>
  );
}

export function EventsTable({
  events,
  currency,
  numberFormat,
  properties,
  onOpen,
}: {
  events: SerializedPlanEvent[];
  currency: string;
  numberFormat: NumberFormat;
  properties: PlanProperty[];
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const add = async () => {
    const id = await createPlanEvent();
    router.refresh();
    onOpen(id);
  };

  const secondary = (ev: SerializedPlanEvent) => {
    if (ev.kind === "PROPERTY_SALE") {
      const label = properties.find((p) => p.id === ev.assetId)?.label ?? "?";
      return `age ${ev.age} · sale of ${label}`;
    }
    return `age ${ev.age} · ${ev.direction === "INFLOW" ? "+" : "−"}${formatAmount(currency, ev.amount, numberFormat)}`;
  };

  return (
    <Panel>
      <Heading>One-off events</Heading>
      {events.length === 0 ? (
        <Empty>No events yet.</Empty>
      ) : (
        <SummaryList>
          {events.map((ev) => (
            <SummaryRow
              key={ev.id}
              primary={ev.label}
              secondary={secondary(ev)}
              onOpen={() => onOpen(ev.id)}
            />
          ))}
        </SummaryList>
      )}
      <AddRowButton label="Add event" onAdd={add} />
    </Panel>
  );
}
