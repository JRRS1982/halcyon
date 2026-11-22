"use client";

import { useId, useTransition } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import type { NumberFormat } from "@/lib/settings/currency";
import { importLimitHint } from "@/lib/transactions/limits";
import type { LedgerUrlQuery } from "@/lib/transactions/pagination";
import type { LedgerCategory, LedgerPage } from "@/lib/transactions/server";
import { setCategoryApproval } from "./actions";
import { ImportPanel } from "./ImportPanel";
import { Ledger } from "./Ledger";
import { QuickAdd } from "./QuickAdd";
import { ReverseImport } from "./ReverseImport";
import { SectionHead } from "./SectionHead";

type Account = { id: string; name: string };
type TransferAccount = {
  id: string;
  name: string;
  kind: "ASSET" | "LIABILITY";
};

const Shell = styled.main`
  max-width: 1240px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};
  /* DESIGN.md → Layout → Grid & Container: gutters drop to 16px on mobile. */
  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
`;

// The ways in under their own head, so a long headline never squeezes them and
// they never read as part of the ledger below: a statement first, the usual
// way, with its undo and its limits beside it; adding one by hand apart, at
// the end of the row.
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.md};
`;

// Pushes Add transaction to the end of the row, apart from the import group.
const Apart = styled.span`
  flex: 1;
`;

// What an import accepts, said once beside the import controls.
const ImportHint = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
`;

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

// What the ledger needs from you, said first: rows with no category are left
// out of the budget, and pencilled ones are the import's guess until ticked.
const headlineFor = (toCheck: number) =>
  toCheck === 0
    ? "Every transaction is approved"
    : `${plural(toCheck, "transaction", "transactions")} to approve`;

const standfirstFor = (uncategorized: number, suggested: number) => {
  if (uncategorized === 0 && suggested === 0) {
    return "Your budget's actuals are complete. Import your next statement when it arrives, or add a transaction by hand.";
  }
  const parts = [
    suggested > 0 &&
      `${plural(suggested, "was", "were")} filed from your history and ${suggested === 1 ? "is" : "are"} shown in pencil: approve ${suggested === 1 ? "it" : "them"} if right, or pick another category.`,
    uncategorized > 0 &&
      `${plural(uncategorized, "has", "have")} no category yet, so ${uncategorized === 1 ? "it is" : "they are"} left out of your budget.`,
  ].filter(Boolean);
  return parts.join(" ");
};

export function TransactionsView({
  accounts,
  transferAccounts,
  categories,
  page,
  query,
  uncategorizedCount,
  suggestedCount,
  transfersEnabled,
  currency,
  numberFormat,
}: {
  // Importable accounts only (canImportTransactions: true) — the import
  // target picker, quick-add, and the ledger's account filter render from
  // this list.
  accounts: Account[];
  // The full, unfiltered account list — transfer targets and the ledger's
  // display-name resolution for transferAccountId are not gated by
  // canImportTransactions.
  transferAccounts: TransferAccount[];
  categories: LedgerCategory[];
  page: LedgerPage;
  query: LedgerUrlQuery;
  uncategorizedCount: number;
  // Categories an import suggested that the user has not ticked yet.
  suggestedCount: number;
  transfersEnabled: boolean;
  currency: string;
  numberFormat: NumberFormat;
}) {
  const [isApproving, startApproving] = useTransition();
  const addHeadId = useId();
  const toCheck = uncategorizedCount + suggestedCount;
  // Approving is reviewing, not adding, so it sits with the ledger's search
  // rather than with the import buttons.
  const approveAll =
    suggestedCount > 0 ? (
      <Button
        type="button"
        disabled={isApproving}
        onClick={() =>
          startApproving(async () => {
            await setCategoryApproval({ approved: true });
          })
        }
      >
        {isApproving
          ? "Approving…"
          : `Approve all ${suggestedCount.toLocaleString("en-GB")} suggested`}
      </Button>
    ) : null;
  return (
    <Shell>
      <PageHeader
        eyebrow="Transactions · money in & out"
        title={headlineFor(toCheck)}
        lead={standfirstFor(uncategorizedCount, suggestedCount)}
      />
      <section aria-labelledby={addHeadId}>
        <SectionHead id={addHeadId}>Add transactions</SectionHead>
        <Actions>
          <ImportPanel
            accounts={accounts}
            currency={currency}
            numberFormat={numberFormat}
          />
          <ReverseImport />
          <ImportHint>{importLimitHint}</ImportHint>
          <Apart />
          <QuickAdd accounts={accounts} categories={categories} />
        </Actions>
      </section>
      <Ledger
        page={page}
        query={query}
        categories={categories}
        transferAccounts={transferAccounts}
        transfersEnabled={transfersEnabled}
        currency={currency}
        numberFormat={numberFormat}
        reviewAction={approveAll}
      />
    </Shell>
  );
}
