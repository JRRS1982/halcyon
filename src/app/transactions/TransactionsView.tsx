"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import type { LedgerCategory, LedgerPage } from "@/lib/transactions/server";
import styled from "styled-components";
import { ImportPanel } from "./ImportPanel";
import { Ledger } from "./Ledger";

type Account = { id: string; name: string };

const Shell = styled.main`
  max-width: 960px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};
`;

export function TransactionsView({
  accounts,
  categories,
  initialPage,
  uncategorizedCount,
}: {
  accounts: Account[];
  categories: LedgerCategory[];
  initialPage: LedgerPage;
  uncategorizedCount: number;
}) {
  return (
    <Shell>
      <PageHeader
        eyebrow="Money in & out"
        title="Transactions"
        lead="Import bank statements and categorize spending against your budget."
      />
      <ImportPanel accounts={accounts} />
      <Ledger
        initialPage={initialPage}
        categories={categories}
        uncategorizedCount={uncategorizedCount}
      />
    </Shell>
  );
}
