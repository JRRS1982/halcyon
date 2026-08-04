"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import type { LedgerUrlQuery } from "@/lib/transactions/pagination";
import type { LedgerCategory, LedgerPage } from "@/lib/transactions/server";
import styled from "styled-components";
import { ImportPanel } from "./ImportPanel";
import { Ledger } from "./Ledger";
import { ReverseImport } from "./ReverseImport";

type Account = { id: string; name: string };

const Shell = styled.main`
  max-width: 960px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};
  /* DESIGN.md → Layout → Grid & Container: gutters drop to 16px on mobile. */
  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
`;

export function TransactionsView({
  accounts,
  categories,
  page,
  query,
  uncategorizedCount,
  transfersEnabled,
}: {
  accounts: Account[];
  categories: LedgerCategory[];
  page: LedgerPage;
  query: LedgerUrlQuery;
  uncategorizedCount: number;
  transfersEnabled: boolean;
}) {
  return (
    <Shell>
      <PageHeader
        eyebrow="Money in & out"
        title="Transactions"
        lead="Import bank statements and categorize spending against your budget."
        actions={
          <>
            <ReverseImport />
            <ImportPanel accounts={accounts} />
          </>
        }
      />
      <Ledger
        page={page}
        query={query}
        categories={categories}
        accounts={accounts}
        uncategorizedCount={uncategorizedCount}
        transfersEnabled={transfersEnabled}
      />
    </Shell>
  );
}
