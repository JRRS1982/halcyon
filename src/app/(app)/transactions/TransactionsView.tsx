"use client";

import styled from "styled-components";
import { PageHeader } from "@/components/ui/PageHeader";
import type { LedgerUrlQuery } from "@/lib/transactions/pagination";
import type { LedgerCategory, LedgerPage } from "@/lib/transactions/server";
import { ImportPanel } from "./ImportPanel";
import { Ledger } from "./Ledger";
import { QuickAdd } from "./QuickAdd";
import { ReverseImport } from "./ReverseImport";

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

// The page's actions on their own ruled row under the headline, so a long
// headline never squeezes them.
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} 0;
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  border-top: 1px solid ${({ theme }) => theme.colors.ink};
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairlineStrong};
`;

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

// What the ledger needs from you, said first: the rows still waiting for a
// category are what stops the budget's actuals being complete.
const headlineFor = (uncategorized: number) =>
  uncategorized === 0
    ? "Every transaction has a category"
    : `${plural(uncategorized, "transaction needs", "transactions need")} a category`;

export function TransactionsView({
  accounts,
  transferAccounts,
  categories,
  page,
  query,
  uncategorizedCount,
  transfersEnabled,
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
  transfersEnabled: boolean;
}) {
  return (
    <Shell>
      <PageHeader
        eyebrow="Transactions · money in & out"
        title={headlineFor(uncategorizedCount)}
        lead={
          uncategorizedCount === 0
            ? "Your budget's actuals are complete. Import your next statement when it arrives, or add a transaction by hand."
            : "Until they have one, they are left out of your budget's actuals and your charts. Filter to uncategorised below and work down the list."
        }
      />
      <Actions>
        <ImportPanel accounts={accounts} />
        <QuickAdd accounts={accounts} categories={categories} />
        <ReverseImport />
      </Actions>
      <Ledger
        page={page}
        query={query}
        categories={categories}
        transferAccounts={transferAccounts}
        uncategorizedCount={uncategorizedCount}
        transfersEnabled={transfersEnabled}
      />
    </Shell>
  );
}
