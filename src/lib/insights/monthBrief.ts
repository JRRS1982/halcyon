// The month in brief: the budget page's headline, its standfirst, and up to
// three notes on why the month went the way it did.
//
// Every sentence is computed from the user's own rows, so it can only state
// what the sheet beneath it already shows: no comparison is invented, and the
// same month always reads the same way. Wording a model could improve on later
// sits on top of these facts; it never replaces them.

import { surplus } from "@/lib/budget/totals";

export type BriefRow = {
  label: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "REPAYMENT";
  direction?: "INFLOW" | "OUTFLOW" | null;
  budget: number;
  actual: number;
  // Earlier months' actuals for the same category, oldest first.
  history: { label: string; actual: number }[];
};

export type BriefNote = { lead: string; body: string };

export type MonthBrief = {
  headline: string;
  standfirst: string;
  notes: BriefNote[];
};

// A row has to move by at least this much to be worth a sentence: £4 over on
// groceries is noise, not a story.
const MATERIAL = 5;
const PENNY = 0.005;
const MAX_NOTES = 3;

const isSpending = (row: BriefRow) =>
  row.type === "EXPENSE" || row.type === "REPAYMENT";

const sum = (rows: BriefRow[], field: "budget" | "actual") =>
  rows.reduce((total, row) => total + row[field], 0);

const overspend = (row: BriefRow) => row.actual - row.budget;

/** "A", "A and B", "A, B and 2 more". */
function listNames(names: string[], max = 2): string {
  if (names.length <= 1) return names.join("");
  if (names.length <= max)
    return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

function headlineFor(
  spending: BriefRow[],
  monthLabel: string,
  fmt: (n: number) => string,
): string {
  const budgeted = sum(spending, "budget");
  const spent = sum(spending, "actual");
  if (budgeted === 0 && spent === 0)
    return `Nothing recorded for ${monthLabel} yet`;
  if (budgeted === 0) return `You spent ${fmt(spent)} in ${monthLabel}`;

  const gap = spent - budgeted;
  if (Math.abs(gap) < PENNY) return "Spending landed exactly on plan";

  const expenses = spending.filter((row) => row.type === "EXPENSE");
  if (gap > 0) {
    const culprits = expenses
      .filter((row) => overspend(row) >= MATERIAL)
      .sort((a, b) => overspend(b) - overspend(a))
      .map((row) => row.label);
    if (culprits.length === 0) return `Spending came in ${fmt(gap)} over plan`;
    return `${listNames(culprits.slice(0, 2))} pushed spending ${fmt(gap)} past plan`;
  }

  const saver = expenses
    .filter((row) => -overspend(row) >= MATERIAL)
    .sort((a, b) => overspend(a) - overspend(b))[0];
  const under = `Spending came in ${fmt(-gap)} under plan`;
  return saver ? `${under}, led by ${saver.label}` : under;
}

function standfirstFor(rows: BriefRow[], fmt: (n: number) => string): string {
  const asItems = rows.map((row, i) => ({ ...row, id: String(i) }));
  const left = surplus(asItems, "actual");
  const planned = surplus(asItems, "budget");
  const leaves =
    left >= 0
      ? `That leaves ${fmt(left)} left over`
      : `That leaves you ${fmt(-left)} short`;

  const nothingPlanned = rows.every((row) => row.budget === 0);
  if (nothingPlanned) return `${leaves}.`;

  const difference = left - planned;
  if (Math.abs(difference) < PENNY) return `${leaves}, exactly as you planned.`;
  const direction = difference > 0 ? "more" : "less";
  return `${leaves}, ${fmt(Math.abs(difference))} ${direction} than the ${fmt(planned)} you planned.`;
}

/** Where this month sits in the category's own history, if it says anything. */
function historyClause(row: BriefRow): string {
  const { history } = row;
  const latest = history.at(-1);
  if (!latest || row.actual <= latest.actual) return "";
  const higherBefore = [...history]
    .reverse()
    .find((m) => m.actual >= row.actual);
  if (!higherBefore) {
    return `, its highest in the ${history.length + 1} months on record`;
  }
  return `, its highest month since ${higherBefore.label}`;
}

function notesFor(
  spending: BriefRow[],
  fmt: (n: number) => string,
): BriefNote[] {
  const notes: BriefNote[] = [];
  const expenses = spending.filter((row) => row.type === "EXPENSE");

  const worst = expenses
    .filter((row) => overspend(row) >= MATERIAL)
    .sort((a, b) => overspend(b) - overspend(a))[0];
  if (worst) {
    notes.push({
      lead: "Where it ran over.",
      body: `${worst.label} ran ${fmt(overspend(worst))} over budget${historyClause(worst)}.`,
    });
  }

  const best = expenses
    .filter((row) => -overspend(row) >= MATERIAL)
    .sort((a, b) => overspend(a) - overspend(b))[0];
  if (best) {
    notes.push({
      lead: "Where you saved.",
      body: `${best.label} came in ${fmt(-overspend(best))} under budget.`,
    });
  }

  const held = expenses
    .filter((row) => row.budget > 0 && Math.abs(overspend(row)) < PENNY)
    .map((row) => row.label);
  if (held.length > 0) {
    notes.push({
      lead: "What held.",
      body: `${listNames(held)} landed exactly on budget.`,
    });
  }

  const spent = sum(spending, "actual");
  const biggest = [...spending].sort((a, b) => b.actual - a.actual)[0];
  if (biggest && spent > 0 && biggest.actual > 0) {
    const share = Math.round((biggest.actual / spent) * 100);
    notes.push({
      lead: "Where it goes.",
      body: `${biggest.label} took ${share}% of everything you spent.`,
    });
  }

  return notes.slice(0, MAX_NOTES);
}

/** The month's headline, standfirst and notes, from the budget rows alone. */
export function monthBrief({
  rows,
  monthLabel,
  fmt,
}: {
  rows: BriefRow[];
  monthLabel: string;
  fmt: (n: number) => string;
}): MonthBrief {
  const spending = rows.filter(isSpending);
  return {
    headline: headlineFor(spending, monthLabel, fmt),
    standfirst: standfirstFor(rows, fmt),
    notes: notesFor(spending, fmt),
  };
}
