"use client";

import { type NumberFormat, formatSignedAmount } from "@/lib/settings/currency";
import type { TransferAccountRow } from "@/lib/transactions/transfers";
import { useState } from "react";
import styled from "styled-components";

const Section = styled.section`
  max-width: 960px;
  margin: ${({ theme }) => theme.spacing["3xl"]} auto 0;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]}
    ${({ theme }) => theme.spacing["3xl"]};
`;

const Title = styled.h2`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  color: ${({ theme }) => theme.colors.dim};
`;

const Lead = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.lg};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  max-width: 60ch;
`;

const Row = styled.button`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  background: none;
  cursor: pointer;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.ink};
  text-align: left;
`;

const Net = styled.span<{ $negative: boolean }>`
  font-variant-numeric: tabular-nums;
  color: ${({ $negative, theme }) =>
    $negative ? theme.colors.ink : theme.colors.positive};
`;

const Parts = styled.div`
  padding: ${({ theme }) => theme.spacing.xs} 0
    ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
`;

const PartRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xs} 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

const Empty = styled.p`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

export function TransfersPanel({
  rows,
  currency,
  numberFormat,
}: {
  rows: TransferAccountRow[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Section>
      <Title>Transfers</Title>
      <Lead>
        Money moved between your own accounts this month — counted as neither
        income nor expense. Each row is one account’s net transfer flow; expand
        it to see where the money went or came from.
      </Lead>
      {rows.length === 0 ? (
        <Empty>No transfers this month.</Empty>
      ) : (
        rows.map((row) => (
          <div key={row.accountId}>
            <Row
              type="button"
              onClick={() =>
                setOpen((id) => (id === row.accountId ? null : row.accountId))
              }
            >
              <span>
                {open === row.accountId ? "▾" : "▸"} {row.accountName}
              </span>
              <Net $negative={row.net < 0}>
                {formatSignedAmount(currency, row.net, numberFormat)}
              </Net>
            </Row>
            {open === row.accountId && (
              <Parts>
                {row.counterparties.map((part) => (
                  <PartRow key={part.accountId}>
                    <span>
                      {part.net < 0 ? "→" : "←"} {part.accountName}
                    </span>
                    <Net $negative={part.net < 0}>
                      {formatSignedAmount(currency, part.net, numberFormat)}
                    </Net>
                  </PartRow>
                ))}
              </Parts>
            )}
          </div>
        ))
      )}
    </Section>
  );
}
