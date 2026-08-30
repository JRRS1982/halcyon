"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import type { CategorySection } from "@/lib/categories/sections";
import { sectionsFor } from "@/lib/categories/sections";
import {
  createManagedCategory,
  deleteCategory,
  mergeCategories,
  updateCategory,
} from "./categoryActions";
import { SectionHeading, SettingsCard } from "./SectionHeading";

export type ManagedCategory = {
  id: string;
  label: string;
  type: "INCOME" | "EXPENSE";
  section: CategorySection;
  sectionLabel: string;
  txnCount: number;
};

const Shell = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]};
  /* DESIGN.md → Layout → Grid & Container: gutters drop to 16px on mobile. */
  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
`;

const Lead = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  max-width: 60ch;
`;

const Search = styled.input`
  width: 100%;
  margin: ${({ theme }) => theme.spacing.lg} 0
    ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const TypeHeader = styled.h3`
  margin: ${({ theme }) => theme.spacing["2xl"]} 0
    ${({ theme }) => theme.spacing.sm};
  padding-bottom: ${({ theme }) => theme.spacing.xs};
  border-bottom: 2px solid ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
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

// The row's action cluster. Inline after the meta on desktop; on a phone it
// takes a full second line, right-aligned, instead of wrapping raggedly with
// one action orphaned per line.
const RowActions = styled.span`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-left: auto;

  @media (max-width: 767px) {
    flex-basis: 100%;
    justify-content: flex-end;
  }
`;

const CreateRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const Empty = styled.p`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

type Mode = { kind: "edit" | "merge" | "delete"; id: string } | null;

const TYPES = [
  { type: "EXPENSE" as const, label: "Expenses" },
  { type: "INCOME" as const, label: "Income" },
];

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
      {sectionsFor(type).map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </Select>
  );
}

// Categories of one type, ordered alphabetically by label. The section is shown
// as a faint tag per row rather than a heading.
function rowsFor(cats: ManagedCategory[]) {
  return [...cats].sort((a, b) => a.label.localeCompare(b.label));
}

export function CategoryManager({
  categories,
}: {
  categories: ManagedCategory[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>(null);
  const [query, setQuery] = useState("");

  // Create form.
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [newSection, setNewSection] = useState<CategorySection>(
    sectionsFor("EXPENSE")[0].value,
  );

  // Edit form.
  const [editLabel, setEditLabel] = useState("");
  const [editType, setEditType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [editSection, setEditSection] = useState<CategorySection>(
    sectionsFor("EXPENSE")[0].value,
  );

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
        section: newSection,
      }),
    );
    setNewLabel("");
  };

  const startEdit = (c: ManagedCategory) => {
    setMode({ kind: "edit", id: c.id });
    setEditLabel(c.label);
    setEditType(c.type);
    setEditSection(c.section);
  };

  const renderRow = (c: ManagedCategory) => {
    if (mode?.kind === "edit" && mode.id === c.id) {
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
              setEditSection(sectionsFor(t)[0].value);
            }}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </Select>
          <SectionSelect
            type={editType}
            value={editSection}
            onChange={(v) => setEditSection(v as CategorySection)}
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
                  section: editSection,
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

    if (mode?.kind === "merge" && mode.id === c.id) {
      // Merge only into same-type categories (an expense into an expense, etc).
      const others = categories.filter(
        (o) => o.id !== c.id && o.type === c.type,
      );
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
                {o.label} ({o.sectionLabel})
              </option>
            ))}
          </Select>
          <TextButton
            type="button"
            disabled={pending || !mergeTarget}
            onClick={() =>
              run(() =>
                mergeCategories({ sourceId: c.id, survivorId: mergeTarget }),
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

    if (mode?.kind === "delete" && mode.id === c.id) {
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
            onClick={() => run(() => deleteCategory({ categoryId: c.id }))}
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
          {c.sectionLabel} · {c.txnCount} txns
        </Meta>
        <RowActions>
          <TextButton type="button" onClick={() => startEdit(c)}>
            Edit
          </TextButton>
          <TextButton
            type="button"
            onClick={() => {
              setMode({ kind: "merge", id: c.id });
              setMergeTarget("");
            }}
          >
            Merge
          </TextButton>
          <TextButton
            type="button"
            $danger
            onClick={() => setMode({ kind: "delete", id: c.id })}
          >
            Delete
          </TextButton>
        </RowActions>
      </Row>
    );
  };

  const term = query.trim().toLowerCase();
  const filtered = term
    ? categories.filter((c) => c.label.toLowerCase().includes(term))
    : categories;

  const typeGroups = TYPES.map((t) => ({
    ...t,
    items: rowsFor(filtered.filter((c) => c.type === t.type)),
  })).filter((g) => g.items.length > 0);

  return (
    <Shell>
      <SettingsCard>
        <SectionHeading>Categories</SectionHeading>
        <Lead>
          Categories group your budget lines and transactions. Rename,
          re-section, merge duplicates, or remove ones you no longer use
          (history is kept).
        </Lead>

        <CreateRow>
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
              setNewSection(sectionsFor(t)[0].value);
            }}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </Select>
          <SectionSelect
            type={newType}
            value={newSection}
            onChange={(v) => setNewSection(v as CategorySection)}
          />
          <Button type="button" onClick={onCreate} disabled={pending}>
            Add
          </Button>
        </CreateRow>

        {categories.length > 0 && (
          <Search
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories…"
          />
        )}

        {categories.length === 0 ? (
          <Empty>
            No categories yet — they appear as you budget and categorise.
          </Empty>
        ) : typeGroups.length === 0 ? (
          <Empty>No categories match “{query}”.</Empty>
        ) : (
          typeGroups.map((g) => (
            <div key={g.type}>
              <TypeHeader>{g.label}</TypeHeader>
              {g.items.map(renderRow)}
            </div>
          ))
        )}
      </SettingsCard>
    </Shell>
  );
}
