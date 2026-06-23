// src/app/plan/EventsTable.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { NumberCell, SelectCell, TextCell } from "./EditableCell";
import { AddRowButton, RemoveCell } from "./RowControls";
import { createPlanEvent, deletePlanEvent, updatePlanEvent } from "./actions";
import type { EventDirection, SerializedPlanEvent } from "./serialized";

const DIRECTIONS: EventDirection[] = ["INFLOW", "OUTFLOW"];

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  overflow-x: auto;
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  th, td { text-align: left; padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xs}; font-size: 13px; vertical-align: middle; }
  thead th {
    font-family: ${({ theme }) => theme.typography.monoCaps.family};
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.dim};
    border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  }
  tbody tr:hover td { background: ${({ theme }) => theme.colors.canvasSoft}; }
  input, select { font-variant-numeric: tabular-nums; }
`;
const Err = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: 13px;
  margin: 0;
`;
const Empty = styled.span`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
`;

function EventRow({ event }: { event: SerializedPlanEvent }) {
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
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      throw e;
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await deletePlanEvent({ id: event.id });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
      throw e;
    }
  };

  return (
    <>
      <tr>
        <td>
          <TextCell
            value={event.label}
            onCommit={(v) => save({ ...event, label: v })}
          />
        </td>
        <td>
          <NumberCell
            value={event.age}
            onCommit={(v) => save({ ...event, age: v ?? event.age })}
          />
        </td>
        <td>
          <SelectCell
            value={event.direction}
            options={DIRECTIONS}
            onCommit={(v) => save({ ...event, direction: v })}
          />
        </td>
        <td>
          <NumberCell
            value={event.amount}
            onCommit={(v) => save({ ...event, amount: v ?? event.amount })}
          />
        </td>
        <td>
          <RemoveCell onConfirm={remove} />
        </td>
      </tr>
      {error ? (
        <tr>
          <td colSpan={5}>
            <Err>{error}</Err>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function EventsTable({ events }: { events: SerializedPlanEvent[] }) {
  const router = useRouter();
  const add = async () => {
    await createPlanEvent();
    router.refresh();
  };

  return (
    <Panel>
      <Heading>One-off events</Heading>
      <Table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Age</th>
            <th>Direction</th>
            <th>Amount</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <Empty>No events yet.</Empty>
              </td>
            </tr>
          ) : (
            events.map((ev) => <EventRow key={ev.id} event={ev} />)
          )}
        </tbody>
      </Table>
      <AddRowButton label="Add event" onAdd={add} />
    </Panel>
  );
}
