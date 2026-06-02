// Turns transfer-tagged transactions into per-account net flow with a
// counterparty breakdown. Each leg is keyed by its OWNING account, so the two
// legs of one real transfer (which live on different accounts) never collapse
// into one figure — double-counting is impossible by construction. Signed:
// money out reads negative, money in positive. Rounded to cents to avoid float
// drift, normalising -0 to 0.

export type TransferLeg = {
  accountId: string;
  accountName: string;
  counterpartyId: string;
  counterpartyName: string;
  amount: number;
};

export type TransferCounterparty = {
  accountId: string;
  accountName: string;
  net: number;
};

export type TransferAccountRow = {
  accountId: string;
  accountName: string;
  net: number;
  counterparties: TransferCounterparty[];
};

const round = (n: number): number => {
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
};

export function netTransfersByAccount(
  legs: TransferLeg[],
): TransferAccountRow[] {
  const accounts = new Map<
    string,
    {
      name: string;
      total: number;
      parts: Map<string, { name: string; total: number }>;
    }
  >();

  for (const leg of legs) {
    const account = accounts.get(leg.accountId) ?? {
      name: leg.accountName,
      total: 0,
      parts: new Map(),
    };
    account.total += leg.amount;
    const part = account.parts.get(leg.counterpartyId) ?? {
      name: leg.counterpartyName,
      total: 0,
    };
    part.total += leg.amount;
    account.parts.set(leg.counterpartyId, part);
    accounts.set(leg.accountId, account);
  }

  return Array.from(accounts.entries())
    .map(([accountId, account]) => ({
      accountId,
      accountName: account.name,
      net: round(account.total),
      counterparties: Array.from(account.parts.entries())
        .map(([id, part]) => ({
          accountId: id,
          accountName: part.name,
          net: round(part.total),
        }))
        .sort((a, b) => a.accountName.localeCompare(b.accountName)),
    }))
    .sort((a, b) => a.accountName.localeCompare(b.accountName));
}
