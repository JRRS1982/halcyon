import { randomUUID } from "node:crypto";
import type {
  BalanceItemCategory,
  BalanceItemType,
  Prisma,
} from "@prisma/client";

// The shape of a BalanceItem row that copy-forward carries into a target
// period — flat enough that this is a straight field-for-field copy.
type SourceBalanceRow = {
  type: BalanceItemType;
  category: BalanceItemCategory;
  label: string;
  value: Prisma.Decimal;
  notes: string | null;
  sortOrder: number;
  accountId: string | null;
};

export type CopiedBalanceRow = {
  id: string;
  type: BalanceItemType;
  category: BalanceItemCategory;
  label: string;
  value: number;
  notes: string | null;
  sortOrder: number;
  accountId: string | null;
  carriedOver: true;
};

// Turns a source period's rows into fresh rows for a target period: a new id
// per row, and `carriedOver: true` because the value is last month's number,
// not one the user has confirmed for the target month yet.
export function toCarriedOverRows(
  items: SourceBalanceRow[],
): CopiedBalanceRow[] {
  return items.map((it) => ({
    id: randomUUID(),
    type: it.type,
    category: it.category,
    label: it.label,
    value: Number(it.value),
    notes: it.notes,
    sortOrder: it.sortOrder,
    accountId: it.accountId,
    carriedOver: true,
  }));
}
