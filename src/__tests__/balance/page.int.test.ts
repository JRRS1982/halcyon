import {
  archiveAccount,
  createAccount,
} from "@/app/(app)/balance/accountActions";
import type { SerializedAccountRow } from "@/app/(app)/balance/BalanceSheet";
import BalancePage from "@/app/(app)/balance/page";

// The sheet's rows are accounts, with the month left-joined on. These pin the
// join itself: which accounts appear on a given month, and what the row
// carries when that month holds no observation for one.

type SheetProps = { initialRows: SerializedAccountRow[] };

const rowsFor = async (ym: string): Promise<SerializedAccountRow[]> => {
  const element = (await BalancePage({
    searchParams: Promise.resolve({ ym }),
  })) as { props: SheetProps };
  return element.props.initialRows;
};

const addIsa = () =>
  createAccount({
    year: 2026,
    month: 2,
    name: "Vanguard ISA",
    type: "STOCKS_ISA",
    section: "LONG_TERM",
    value: 42300,
    canImportTransactions: false,
    mortgage: null,
  });

describe("balance page rows (integration)", () => {
  it("carries the month's value onto the account's row", async () => {
    await addIsa();

    const rows = await rowsFor("2026-03");

    const isa = rows.find((r) => r.name === "Vanguard ISA");
    expect(isa).toMatchObject({
      type: "STOCKS_ISA",
      kind: "ASSET",
      section: "LONG_TERM",
      value: 42300,
      carriedOver: false,
    });
  });

  // The reason accounts are queried first: a month the user has not filled in
  // still lists everything they own, with an empty cell to type into.
  it("still lists the account on a month it has no value in", async () => {
    await addIsa();

    const rows = await rowsFor("2026-04");

    const isa = rows.find((r) => r.name === "Vanguard ISA");
    expect(isa).toBeDefined();
    expect(isa?.value).toBeNull();
    expect(isa?.notes).toBeNull();
  });

  // Archiving is "stop tracking from here": the account leaves this month's
  // sheet, and the months it already recorded a value in keep it.
  it("keeps an archived account on the months it recorded a value, and drops it from the rest", async () => {
    const { accountId } = await addIsa();
    await archiveAccount({
      accountId,
      alsoLinked: false,
      fromYear: 2026,
      fromMonth: 3,
    });

    const march = await rowsFor("2026-03");
    const april = await rowsFor("2026-04");

    expect(march.some((r) => r.accountId === accountId)).toBe(true);
    expect(april.some((r) => r.accountId === accountId)).toBe(false);
  });
});
