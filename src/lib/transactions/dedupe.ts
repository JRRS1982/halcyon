// Builds a stable fingerprint used to flag likely-duplicate transactions at
// import time. Scoped per account; matches on the calendar day (time-of-day
// ignored), the signed amount in cents, and a normalized description. Two rows
// with the same fingerprint are surfaced for the user to confirm or drop —
// they are never silently merged.

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeDescription(description: string): string {
  return description.trim().replace(/\s+/g, " ").toLowerCase();
}

export type FingerprintInput = {
  accountId: string;
  date: Date;
  amount: number;
  description: string;
};

export function transactionFingerprint({
  accountId,
  date,
  amount,
  description,
}: FingerprintInput): string {
  const cents = Math.round(amount * 100);
  return [
    accountId,
    isoDay(date),
    cents,
    normalizeDescription(description),
  ].join("|");
}
