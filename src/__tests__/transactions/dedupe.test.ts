import { transactionFingerprint } from "@/lib/transactions/dedupe";

const base = {
  accountId: "acc-1",
  date: new Date("2026-03-14T00:00:00Z"),
  amount: -50,
  description: "Tesco",
};

describe("transactionFingerprint", () => {
  test("identical fields produce an identical fingerprint", () => {
    expect(transactionFingerprint(base)).toBe(transactionFingerprint(base));
  });

  test("ignores description case and whitespace", () => {
    expect(transactionFingerprint({ ...base, description: "  TESCO  " })).toBe(
      transactionFingerprint(base),
    );
  });

  test("ignores the time-of-day portion of the date", () => {
    expect(
      transactionFingerprint({
        ...base,
        date: new Date("2026-03-14T18:30:00Z"),
      }),
    ).toBe(transactionFingerprint(base));
  });

  test("treats 50 and 50.00 as the same amount", () => {
    expect(transactionFingerprint({ ...base, amount: -50.0 })).toBe(
      transactionFingerprint(base),
    );
  });

  test("distinguishes account, date, amount, sign and description", () => {
    const fp = transactionFingerprint(base);
    expect(transactionFingerprint({ ...base, accountId: "acc-2" })).not.toBe(
      fp,
    );
    expect(
      transactionFingerprint({
        ...base,
        date: new Date("2026-03-15T00:00:00Z"),
      }),
    ).not.toBe(fp);
    expect(transactionFingerprint({ ...base, amount: -51 })).not.toBe(fp);
    expect(transactionFingerprint({ ...base, amount: 50 })).not.toBe(fp);
    expect(
      transactionFingerprint({ ...base, description: "Sainsbury" }),
    ).not.toBe(fp);
  });
});
