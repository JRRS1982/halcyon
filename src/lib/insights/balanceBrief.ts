// The balance sheet's headline, standfirst and notes: where net worth stands
// for the month, how it moved since the last recorded month, and which
// accounts did the moving.
//
// Movement is measured only across accounts with a value in both months, so an
// account the user has not got round to filling in yet reads as "still to
// record", never as a fall to zero.

import type { MonthBrief } from "./monthBrief";

export type BalanceBriefRow = {
  name: string;
  kind: "ASSET" | "LIABILITY";
  value: number | null;
  previous: number | null;
};

// Below a pound, a movement is rounding, not news.
const MATERIAL = 1;
const MAX_NOTES = 3;

// What a row contributes to net worth: an asset adds, a debt subtracts.
const signed = (kind: BalanceBriefRow["kind"], value: number) =>
  kind === "ASSET" ? value : -value;

type Move = { row: BalanceBriefRow; value: number; change: number };

function movesOf(rows: BalanceBriefRow[]): Move[] {
  return rows.flatMap((row) =>
    row.value !== null && row.previous !== null
      ? [{ row, value: row.value, change: row.value - row.previous }]
      : [],
  );
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  if (names.length <= 3) {
    return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  }
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/** The balance sheet's brief for one month, against the previous one. */
export function balanceBrief({
  rows,
  previousLabel,
  fmt,
}: {
  rows: BalanceBriefRow[];
  // The last month with values before this one, or null when there is none.
  previousLabel: string | null;
  fmt: (n: number) => string;
}): MonthBrief {
  const money = (n: number) => (n < 0 ? `−${fmt(-n)}` : fmt(n));
  const recorded = rows.filter((row) => row.value !== null);
  const owned = recorded
    .filter((row) => row.kind === "ASSET")
    .reduce((total, row) => total + (row.value ?? 0), 0);
  const owed = recorded
    .filter((row) => row.kind === "LIABILITY")
    .reduce((total, row) => total + (row.value ?? 0), 0);
  const netWorth = owned - owed;

  const moves = previousLabel ? movesOf(rows) : [];
  const netChange = moves.reduce(
    (total, move) => total + signed(move.row.kind, move.change),
    0,
  );
  const headline =
    moves.length === 0 || Math.abs(netChange) < MATERIAL
      ? `Net worth stands at ${money(netWorth)}`
      : `Net worth ${netChange > 0 ? "rose" : "fell"} ${fmt(Math.abs(netChange))} to ${money(netWorth)}`;

  const notes: MonthBrief["notes"] = [];
  const since = previousLabel ? ` since ${previousLabel}` : "";
  const assetMoves = moves.filter((m) => m.row.kind === "ASSET");

  const gain = [...assetMoves].sort((a, b) => b.change - a.change)[0];
  if (gain && gain.change >= MATERIAL) {
    notes.push({
      lead: "Biggest gain.",
      body: `${gain.row.name} rose ${fmt(gain.change)} to ${fmt(gain.value)}${since}.`,
    });
  }

  const debtChange = moves
    .filter((m) => m.row.kind === "LIABILITY")
    .reduce((total, m) => total + m.change, 0);
  if (debtChange <= -MATERIAL && previousLabel) {
    notes.push({
      lead: "Debt paid down.",
      body: `You owe ${fmt(-debtChange)} less than in ${previousLabel}.`,
    });
  }

  const drop = [...assetMoves].sort((a, b) => a.change - b.change)[0];
  if (drop && drop.change <= -MATERIAL) {
    notes.push({
      lead: "Biggest drop.",
      body: `${drop.row.name} fell ${fmt(-drop.change)} to ${fmt(drop.value)}${since}.`,
    });
  }

  const missing = rows.filter((row) => row.value === null).map((r) => r.name);
  if (missing.length > 0) {
    notes.unshift({
      lead: "Still to record.",
      body: `${listNames(missing)} ${missing.length === 1 ? "has" : "have"} no value for this month yet.`,
    });
  }

  return {
    headline,
    standfirst: `You own ${fmt(owned)} and owe ${fmt(owed)}.`,
    notes: notes.slice(0, MAX_NOTES),
  };
}

export type AccountChange = {
  amount: number;
  rose: boolean;
  favourable: boolean;
};

/**
 * How one account (or a total of them) moved since the previous month: which
 * way, by how much, and whether that helped. A debt falling is favourable.
 * Null when either month has no value, or nothing moved.
 */
export function accountChange(
  kind: BalanceBriefRow["kind"],
  value: number | null,
  previous: number | null,
): AccountChange | null {
  if (value === null || previous === null) return null;
  const change = value - previous;
  if (Math.abs(change) < MATERIAL) return null;
  const rose = change > 0;
  return {
    amount: Math.abs(change),
    rose,
    favourable: kind === "ASSET" ? rose : !rose,
  };
}
