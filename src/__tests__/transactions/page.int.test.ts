import type { ReactElement } from "react";
import TransactionsPage from "@/app/(app)/transactions/page";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// The moment the accounts backfill runs, every historical balance line
// becomes an Account — the user's mortgage, house and pension included.
// canImportTransactions: false is what's supposed to keep those out of the
// transactions page's *importable* account list (import picker, quick-add,
// ledger filter); this pins that the page's query actually applies the flag.
//
// That flag must NOT also gate the separate, unfiltered list the page hands
// to the ledger for transfer targets and transferAccountId display
// resolution — see CategoryCombobox's `transferAccounts` prop. An account
// excluded from import (a mortgage) is exactly the kind of account a user
// still needs to record a transfer to.

describe("TransactionsPage account list (integration)", () => {
  test("excludes an account with imports switched off from the importable list", async () => {
    await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        ...buildAccountData({ type: "MORTGAGE" }),
        canImportTransactions: false,
      },
    });
    await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Monzo",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
        canImportTransactions: true,
      },
    });

    const element = (await TransactionsPage({
      searchParams: Promise.resolve({}),
    })) as ReactElement<{ accounts: { id: string; name: string }[] }>;

    const names = element.props.accounts.map((a) => a.name);
    expect(names).toEqual(["Monzo"]);
  });

  test("still includes an account with imports switched off in the transfer-target list", async () => {
    await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        ...buildAccountData({ type: "MORTGAGE" }),
        canImportTransactions: false,
      },
    });
    await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Monzo",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
        canImportTransactions: true,
      },
    });

    const element = (await TransactionsPage({
      searchParams: Promise.resolve({}),
    })) as ReactElement<{
      transferAccounts: { id: string; name: string }[];
    }>;

    const names = element.props.transferAccounts.map((a) => a.name);
    expect(names).toEqual(["Halifax mortgage", "Monzo"]);
  });
});

// A filter that lives in the URL is only real if the route hands it to the
// query. This walks the whole path — searchParams → parseLedgerSearchParams →
// getTransactionsPage — rather than trusting the parser and the predicate,
// both already tested, to have been wired together.
describe("TransactionsPage filter wiring (integration)", () => {
  const seed = async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Monzo",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });
    await prisma.transaction.createMany({
      data: [
        {
          userId: TEST_USER_ID,
          accountId: account.id,
          date: new Date("2026-01-10"),
          amount: -12,
          description: "January",
        },
        {
          userId: TEST_USER_ID,
          accountId: account.id,
          date: new Date("2026-06-10"),
          amount: -900,
          description: "June",
        },
      ],
    });
    return account;
  };

  const renderWith = async (
    searchParams: Record<string, string>,
  ): Promise<string[]> => {
    const element = (await TransactionsPage({
      searchParams: Promise.resolve(searchParams),
    })) as ReactElement<{ page: { items: { description: string }[] } }>;
    return element.props.page.items.map((t) => t.description);
  };

  test("a date range in the URL reaches the query", async () => {
    await seed();
    expect(await renderWith({ from: "2026-01-01", to: "2026-03-31" })).toEqual([
      "January",
    ]);
  });

  test("an account in the URL reaches the query", async () => {
    const account = await seed();
    expect(await renderWith({ acct: account.id })).toHaveLength(2);
    // A well-formed id for an account that isn't there matches nothing...
    expect(
      await renderWith({ acct: "99999999-9999-9999-9999-999999999999" }),
    ).toEqual([]);
  });

  test("a malformed account id renders the page instead of erroring", async () => {
    await seed();
    // ...but a non-uuid would be a Prisma error and a 500 on a page anyone can
    // reach by editing the address bar, so the parser drops it and the ledger
    // renders unfiltered.
    expect(await renderWith({ acct: "no-such-account" })).toHaveLength(2);
  });

  test("an amount bound in the URL reaches the query", async () => {
    await seed();
    expect(await renderWith({ min: "100" })).toEqual(["June"]);
    expect(await renderWith({ max: "100" })).toEqual(["January"]);
  });
});
