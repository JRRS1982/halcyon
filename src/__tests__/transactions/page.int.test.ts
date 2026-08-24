import type { ReactElement } from "react";
import TransactionsPage from "@/app/(app)/transactions/page";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// The moment the accounts backfill runs, every historical balance line
// becomes an Account — the user's mortgage, house and pension included.
// canImportTransactions: false is what's supposed to keep those out of the
// transactions page's account list (import picker, quick-add, ledger
// filter); this pins that the page's query actually applies the flag.

describe("TransactionsPage account list (integration)", () => {
  test("excludes an account with imports switched off", async () => {
    await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        kind: "LIABILITY",
        canImportTransactions: false,
      },
    });
    await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Monzo",
        canImportTransactions: true,
      },
    });

    const element = (await TransactionsPage({
      searchParams: Promise.resolve({}),
    })) as ReactElement<{ accounts: { id: string; name: string }[] }>;

    const names = element.props.accounts.map((a) => a.name);
    expect(names).toEqual(["Monzo"]);
  });
});
