"use client";

import Link from "next/link";
import { useTransition } from "react";
import styled, { css } from "styled-components";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import type { LedgerUrlQuery } from "@/lib/transactions/pagination";
import type { LedgerCategory, LedgerPage } from "@/lib/transactions/server";
import { confirmTransactionCategories } from "./actions";
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

// What the ledger needs from you, said first: rows with no category are left
// out of the budget, and pencilled ones are the import's guess until ticked.
const headlineFor = (toCheck: number) =>
  toCheck === 0
    ? "Every transaction is checked"
    : `${plural(toCheck, "transaction", "transactions")} to check`;

const standfirstFor = (uncategorized: number, suggested: number) => {
  if (uncategorized === 0 && suggested === 0) {
    return "Your budget's actuals are complete. Import your next statement when it arrives, or add a transaction by hand.";
  }
  const parts = [
    suggested > 0 &&
      `${plural(suggested, "was", "were")} filed from your history and ${suggested === 1 ? "is" : "are"} shown in pencil: tick ${suggested === 1 ? "it" : "them"} if right, or pick another category.`,
    uncategorized > 0 &&
      `${plural(uncategorized, "has", "have")} no category yet, so ${uncategorized === 1 ? "it is" : "they are"} left out of your budget.`,
  ].filter(Boolean);
  return parts.join(" ");
};

// To check / All: the review queue, or the whole ledger.
const Views = styled.nav`
  display: inline-flex;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.ink};
  border-radius: ${({ theme }) => theme.rounded.sm};
  overflow: hidden;
`;

const ViewLink = styled(Link)<{ $current: boolean }>`
  ${({ theme, $current }) => css`
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    font-family: ${theme.typography.control.family};
    font-size: ${theme.typography.control.size};
    font-weight: ${theme.typography.control.weight};
    text-decoration: none;
    color: ${$current ? theme.colors.onPrimary : theme.colors.ink};
    background: ${$current ? theme.colors.primary : "transparent"};
  `}
`;

export function TransactionsView({
  accounts,
  transferAccounts,
  categories,
  page,
  query,
  uncategorizedCount,
  suggestedCount,
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
  // Categories an import suggested that the user has not ticked yet.
  suggestedCount: number;
  transfersEnabled: boolean;
}) {
  const [isTicking, startTicking] = useTransition();
  const toCheck = uncategorizedCount + suggestedCount;
  return (
    <Shell>
      <PageHeader
        eyebrow="Transactions · money in & out"
        title={headlineFor(toCheck)}
        lead={standfirstFor(uncategorizedCount, suggestedCount)}
      />
      <Actions>
        {suggestedCount > 0 && (
          <Button
            type="button"
            disabled={isTicking}
            onClick={() =>
              startTicking(async () => {
                await confirmTransactionCategories();
              })
            }
          >
            {isTicking
              ? "Ticking…"
              : `Tick all ${suggestedCount.toLocaleString("en-GB")} suggested`}
          </Button>
        )}
        <ImportPanel accounts={accounts} />
        <QuickAdd accounts={accounts} categories={categories} />
        <ReverseImport />
      </Actions>
      <Views aria-label="Which transactions to show">
        <ViewLink
          href="/transactions?check=1"
          $current={query.onlyToCheck}
          aria-current={query.onlyToCheck ? "page" : undefined}
        >
          To check · {toCheck.toLocaleString("en-GB")}
        </ViewLink>
        <ViewLink
          href="/transactions"
          $current={!query.onlyToCheck}
          aria-current={query.onlyToCheck ? undefined : "page"}
        >
          All transactions
        </ViewLink>
      </Views>
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
