"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import styled from "styled-components";

const Shell = styled.main`
  max-width: 960px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};
`;

const Placeholder = styled.p`
  margin-top: ${({ theme }) => theme.spacing["2xl"]};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
  max-width: 60ch;
`;

export function TransactionsView() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Money in & out"
        title="Transactions"
        lead="Import bank statements and categorize spending against your budget."
      />
      <Placeholder>
        Statement import and the transactions ledger are coming next. Manage
        your categories in Settings in the meantime.
      </Placeholder>
    </Shell>
  );
}
