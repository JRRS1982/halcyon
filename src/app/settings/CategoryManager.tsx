"use client";

import { Button } from "@/components/ui/Button";
import {
  EXPENSE_BUCKETS,
  INCOME_BUCKETS,
  sectionOrderIndex,
} from "@/lib/categories/buckets";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import styled from "styled-components";
import {
  createManagedCategory,
  deleteCategory,
  mergeCategories,
  updateCategory,
} from "./categoryActions";

export type ManagedCategory = {
  id: string;
  label: string;
  type: "INCOME" | "EXPENSE";
  bucket: string | null;
  section: string;
  txnCount: number;
};

const Shell = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]}
    ${({ theme }) => theme.spacing["5xl"]};
`;

const Heading = styled.h2`
  margin: 0 0 ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  color: ${({ theme }) => theme.colors.dim};
`;

const Lead = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  max-width: 60ch;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
`;

const Grow = styled.span`
  flex: 1;
  min-width: 120px;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.ink};
`;

const Meta = styled.span`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
  white-space: nowrap;
`;

const Input = styled.input`
  flex: 1;
  min-width: 120px;
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const Select = styled.select`
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const TextButton = styled.button<{ $danger?: boolean }>`
  border: none;
  background: none;
  padding: ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ $danger, theme }) =>
    $danger ? theme.colors.negative : theme.colors.accent};
  cursor: pointer;

  &:disabled {
    color: ${({ theme }) => theme.colors.dim};
    cursor: default;
  }
`;

const Empty = styled.p`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

const SectionHeader = styled.h3`
  margin: ${({ theme }) => theme.spacing.xl} 0 0;
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  color: ${({ theme }) => theme.colors.bodyMuted};
`;

type Mode = { kind: "edit" | "merge" | "delete"; id: string } | null;

function bucketsFor(type: "INCOME" | "EXPENSE") {
  return type === "EXPENSE" ? EXPENSE_BUCKETS : INCOME_BUCKETS;
}

function SectionSelect({
  type,
  value,
  onChange,
}: {
  type: "INCOME" | "EXPENSE";
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {bucketsFor(type).map((b) => (
        <option key={b.value} value={b.value}>
          {b.label}
        </option>
      ))}
    </Select>
  );
}

export function CategoryManager({
  categories,
}: {
  categories: ManagedCategory[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>(null);

  // Create form.
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [newBucket, setNewBucket] = useState<string>(EXPENSE_BUCKETS[0].value);

  // Edit form.
  const [editLabel, setEditLabel] = useState("");
  const [editType, setEditType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [editBucket, setEditBucket] = useState("");

  // Merge target.
  const [mergeTarget, setMergeTarget] = useState("");

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      setMode(null);
      router.refresh();
    });

  const onCreate = () => {
    if (!newLabel.trim()) return;
    run(() =>
      createManagedCategory({
        label: newLabel,
        type: newType,
        bucket: newBucket,
      }),
    );
    setNewLabel("");
  };

  const startEdit = (c: ManagedCategory) => {
    setMode({ kind: "edit", id: c.id });
    setEditLabel(c.label);
    setEditType(c.type);
    setEditBucket(c.bucket ?? bucketsFor(c.type)[0].value);
  };

  const startMerge = (c: ManagedCategory) => {
    setMode({ kind: "merge", id: c.id });
    setMergeTarget("");
  };

  // Group by section in display order (Fixed → Variable → Discretionary →
  // income → Other → Unsectioned), alphabetical within each.
  const byBucket: Record<string, ManagedCategory[]> = {};
  for (const c of categories) {
    const key = c.bucket ?? "__none__";
    if (!byBucket[key]) byBucket[key] = [];
    byBucket[key].push(c);
  }
  const groups = Object.keys(byBucket)
    .sort(
      (a, b) =>
        sectionOrderIndex(a === "__none__" ? null : a) -
        sectionOrderIndex(b === "__none__" ? null : b),
    )
    .map((key) => ({
      key,
      label: byBucket[key][0].section,
      items: [...byBucket[key]].sort((a, b) => a.label.localeCompare(b.label)),
    }));

  return (
    <Shell>
      <Heading>Categories</Heading>
      <Lead>
        Categories group your budget lines and transactions. Rename, re-section,
        merge duplicates, or remove ones you no longer use (history is kept).
      </Lead>

      <Row>
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New category…"
        />
        <Select
          value={newType}
          onChange={(e) => {
            const t = e.target.value as "EXPENSE" | "INCOME";
            setNewType(t);
            setNewBucket(bucketsFor(t)[0].value);
          }}
        >
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
        </Select>
        <SectionSelect
          type={newType}
          value={newBucket}
          onChange={setNewBucket}
        />
        <Button type="button" onClick={onCreate} disabled={pending}>
          Add
        </Button>
      </Row>

      {categories.length === 0 ? (
        <Empty>
          No categories yet — they appear as you budget and categorise.
        </Empty>
      ) : (
        groups.map((g) => (
          <div key={g.key}>
            <SectionHeader>{g.label}</SectionHeader>
            {g.items.map((c) => {
              const editing = mode?.kind === "edit" && mode.id === c.id;
              const merging = mode?.kind === "merge" && mode.id === c.id;
              const deleting = mode?.kind === "delete" && mode.id === c.id;

              if (editing) {
                return (
                  <Row key={c.id}>
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                    />
                    <Select
                      value={editType}
                      onChange={(e) => {
                        const t = e.target.value as "EXPENSE" | "INCOME";
                        setEditType(t);
                        setEditBucket(bucketsFor(t)[0].value);
                      }}
                    >
                      <option value="EXPENSE">Expense</option>
                      <option value="INCOME">Income</option>
                    </Select>
                    <SectionSelect
                      type={editType}
                      value={editBucket}
                      onChange={setEditBucket}
                    />
                    <TextButton
                      type="button"
                      disabled={pending || !editLabel.trim()}
                      onClick={() =>
                        run(() =>
                          updateCategory({
                            categoryId: c.id,
                            label: editLabel,
                            type: editType,
                            bucket: editBucket,
                          }),
                        )
                      }
                    >
                      Save
                    </TextButton>
                    <TextButton type="button" onClick={() => setMode(null)}>
                      Cancel
                    </TextButton>
                  </Row>
                );
              }

              if (merging) {
                const others = categories.filter((o) => o.id !== c.id);
                return (
                  <Row key={c.id}>
                    <Grow>
                      Merge <strong>{c.label}</strong> into:
                    </Grow>
                    <Select
                      value={mergeTarget}
                      onChange={(e) => setMergeTarget(e.target.value)}
                    >
                      <option value="">Choose…</option>
                      {others.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label} ({o.section})
                        </option>
                      ))}
                    </Select>
                    <TextButton
                      type="button"
                      disabled={pending || !mergeTarget}
                      onClick={() =>
                        run(() =>
                          mergeCategories({
                            sourceId: c.id,
                            survivorId: mergeTarget,
                          }),
                        )
                      }
                    >
                      Merge
                    </TextButton>
                    <TextButton type="button" onClick={() => setMode(null)}>
                      Cancel
                    </TextButton>
                  </Row>
                );
              }

              if (deleting) {
                return (
                  <Row key={c.id}>
                    <Grow>
                      Remove <strong>{c.label}</strong>?
                      {c.txnCount > 0
                        ? ` ${c.txnCount} transaction(s) keep it for history.`
                        : ""}
                    </Grow>
                    <TextButton
                      type="button"
                      $danger
                      disabled={pending}
                      onClick={() =>
                        run(() => deleteCategory({ categoryId: c.id }))
                      }
                    >
                      Remove
                    </TextButton>
                    <TextButton type="button" onClick={() => setMode(null)}>
                      Cancel
                    </TextButton>
                  </Row>
                );
              }

              return (
                <Row key={c.id}>
                  <Grow>{c.label}</Grow>
                  <Meta>
                    {c.section} · {c.type === "INCOME" ? "in" : "out"} ·{" "}
                    {c.txnCount} txns
                  </Meta>
                  <TextButton type="button" onClick={() => startEdit(c)}>
                    Edit
                  </TextButton>
                  <TextButton type="button" onClick={() => startMerge(c)}>
                    Merge
                  </TextButton>
                  <TextButton
                    type="button"
                    $danger
                    onClick={() => setMode({ kind: "delete", id: c.id })}
                  >
                    Delete
                  </TextButton>
                </Row>
              );
            })}
          </div>
        ))
      )}
    </Shell>
  );
}
