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
import type { EventDirection, SerializedPlanEvent } from "./serialized";

const DIRECTIONS: EventDirection[] = ["INFLOW", "OUTFLOW"];

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

export function EventFields({ event }: { event: SerializedPlanEvent }) {
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
      </DrawerSection>
    </>
  );
}

export function EventsTable({
  events,
  currency,
  numberFormat,
  onOpen,
}: {
  events: SerializedPlanEvent[];
  currency: string;
  numberFormat: NumberFormat;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const add = async () => {
    const id = await createPlanEvent();
    router.refresh();
    onOpen(id);
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
              secondary={`age ${ev.age} · ${ev.direction === "INFLOW" ? "+" : "−"}${formatAmount(currency, ev.amount, numberFormat)}`}
              onOpen={() => onOpen(ev.id)}
            />
          ))}
        </SummaryList>
      )}
      <AddRowButton label="Add event" onAdd={add} />
    </Panel>
  );
}
