// The overall picture: the dashboard's headline, standfirst and notes across
// every month in its window, where the budget page's brief is about one month.
//
// Computed from the same series the dashboard's charts draw, so every sentence
// is a reading of a chart on the page, said outright.

import type {
  BalancePoint,
  CashFlowPoint,
  ExpenditurePoint,
} from "@/lib/dashboard/series";
import type { MonthBrief } from "./monthBrief";

// The spending sections the dashboard charts, in the words a sentence uses.
const SECTIONS = [
  { key: "fixedActual", name: "Fixed" },
  { key: "variableActual", name: "Variable" },
  { key: "discretionaryActual", name: "Discretionary" },
] as const;

// A section has to move by this much a month before "growing" is worth saying.
const MATERIAL_MONTHLY_CHANGE = 20;
const RECENT = 3;

const sumOf = (values: number[]) => values.reduce((t, v) => t + v, 0);
const average = (values: number[]) => sumOf(values) / values.length;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function headlineFor(
  balance: BalancePoint[],
  cashFlow: CashFlowPoint[],
  fmt: (n: number) => string,
): string | null {
  const first = balance[0];
  const last = balance.at(-1);
  if (first && last && balance.length >= 2) {
    const change = last.net - first.net;
    const direction = change >= 0 ? "up" : "down";
    return `Net worth ${direction} ${fmt(Math.abs(change))} since ${first.month}, to ${fmt(last.net)}`;
  }
  const income = sumOf(cashFlow.map((m) => m.income));
  if (cashFlow.length === 0 || income <= 0) return null;
  const kept = sumOf(cashFlow.map((m) => m.net));
  return `You kept ${Math.round((kept / income) * 100)}% of your income over ${plural(cashFlow.length, "month")}`;
}

function standfirstFor(
  cashFlow: CashFlowPoint[],
  fmt: (n: number) => string,
): string {
  const income = sumOf(cashFlow.map((m) => m.income));
  if (cashFlow.length === 0 || income <= 0) return "";
  const kept = sumOf(cashFlow.map((m) => m.net));
  const rate = Math.round((kept / income) * 100);
  const span = plural(cashFlow.length, "month");
  if (kept < 0) {
    return `Over ${span} you brought in ${fmt(income)} and spent ${fmt(-kept)} more than that.`;
  }
  return `Over ${span} you brought in ${fmt(income)} and kept ${fmt(kept)} of it, ${rate}% of your income.`;
}

function surplusNote(cashFlow: CashFlowPoint[], fmt: (n: number) => string) {
  if (cashFlow.length < 2) return null;
  const inSurplus = cashFlow.filter((m) => m.net >= 0).length;
  const weakest = [...cashFlow].sort((a, b) => a.net - b.net)[0];
  const exception =
    weakest && weakest.net < 0
      ? ` The ${inSurplus === cashFlow.length - 1 ? "exception" : "weakest"} was ${weakest.month}, ${fmt(-weakest.net)} short.`
      : "";
  return {
    lead: "Months in surplus.",
    body: `${inSurplus} of the last ${cashFlow.length} months ended with money left over.${exception}`,
  };
}

function trendNote(
  expenditure: ExpenditurePoint[],
  fmt: (n: number) => string,
) {
  if (expenditure.length < RECENT * 2) return null;
  const recent = expenditure.slice(-RECENT);
  const before = expenditure.slice(-RECENT * 2, -RECENT);
  const moves = SECTIONS.map((section) => {
    const now = average(recent.map((m) => m[section.key]));
    const then = average(before.map((m) => m[section.key]));
    return { name: section.name, now, change: now - then };
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const biggest = moves[0];
  if (!biggest || Math.abs(biggest.change) < MATERIAL_MONTHLY_CHANGE)
    return null;
  const rising = biggest.change > 0;
  return {
    lead: rising ? "What's growing." : "What's easing.",
    body: `${biggest.name} spending averaged ${fmt(biggest.now)} a month over the last three months, ${rising ? "up" : "down"} ${fmt(Math.abs(biggest.change))} on the three before.`,
  };
}

function bestMonthNote(cashFlow: CashFlowPoint[], fmt: (n: number) => string) {
  if (cashFlow.length < 2) return null;
  const best = [...cashFlow].sort((a, b) => b.net - a.net)[0];
  if (!best || best.net <= 0) return null;
  return {
    lead: "Best month.",
    body: `${best.month} left the most over: ${fmt(best.net)}.`,
  };
}

/** The dashboard's overall picture, or null when there is nothing to read. */
export function overallBrief({
  balance,
  cashFlow,
  expenditure,
  fmt,
}: {
  balance: BalancePoint[];
  cashFlow: CashFlowPoint[];
  expenditure: ExpenditurePoint[];
  fmt: (n: number) => string;
}): MonthBrief | null {
  const headline = headlineFor(balance, cashFlow, fmt);
  if (!headline) return null;
  const notes = [
    surplusNote(cashFlow, fmt),
    trendNote(expenditure, fmt),
    bestMonthNote(cashFlow, fmt),
  ].filter((note) => note !== null);
  return { headline, standfirst: standfirstFor(cashFlow, fmt), notes };
}
