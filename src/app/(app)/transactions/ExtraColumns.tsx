"use client";

import styled from "styled-components";

// The statement columns kept with a transaction ("Also keep" at import), laid
// out as KEY value pairs. Shared by the ledger's Details panel and the import
// preview, so what the preview shows is exactly what the ledger will.

const List = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const Pair = styled.span`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.ink};
`;

const Key = styled.span`
  font-family: ${({ theme }) => theme.typography.kicker.family};
  font-size: ${({ theme }) => theme.typography.kicker.size};
  font-weight: ${({ theme }) => theme.typography.kicker.weight};
  letter-spacing: ${({ theme }) => theme.typography.kicker.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.dim};
  margin-right: ${({ theme }) => theme.spacing.xs};
`;

export function ExtraColumns({ extra }: { extra: Record<string, string> }) {
  return (
    <List>
      {Object.entries(extra).map(([key, value]) => (
        <Pair key={key}>
          <Key>{key}</Key>
          {value}
        </Pair>
      ))}
    </List>
  );
}
