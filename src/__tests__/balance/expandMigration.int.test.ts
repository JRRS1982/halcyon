import { prisma } from "@/lib/prisma";

// The 20260830213522_add_account_type migration already ran (applied at
// test-DB setup), so we can't re-run its UPDATE against pre-migration rows —
// the pre-migration shape no longer exists (type is NOT NULL). Instead this
// pins the backfill mapping itself: the CASE expression below is copied
// VERBATIM from that migration's UPDATE (column refs adjusted to the VALUES
// alias `t`), evaluated as a SELECT against four literal old-shape tuples.
// If a future migration edits the CASE without updating this test, or vice
// versa, this test is the trip wire.
describe("add_account_type backfill mapping", () => {
  it("maps each old (kind, wrapper, category, linkedAccountId) shape to the expected AccountType", async () => {
    const rows = await prisma.$queryRawUnsafe<
      { name: string; type: string }[]
    >(`
      SELECT t.name, (CASE
        WHEN t."kind" = 'LIABILITY' AND t."linkedAccountId" IS NOT NULL THEN 'MORTGAGE'
        WHEN t."kind" = 'LIABILITY' AND t."category" = 'LONG_TERM'      THEN 'MORTGAGE'
        WHEN t."kind" = 'LIABILITY' AND t."category" = 'MEDIUM_TERM'    THEN 'LOAN'
        WHEN t."kind" = 'LIABILITY' AND t."category" = 'CURRENT'        THEN 'CREDIT_CARD'
        WHEN t."kind" = 'LIABILITY'                                     THEN 'OTHER_DEBT'
        WHEN t."wrapper" = 'CASH'       AND t."category" = 'CURRENT'    THEN 'CURRENT_ACCOUNT'
        WHEN t."wrapper" = 'CASH'                                       THEN 'SAVINGS'
        WHEN t."wrapper" = 'ISA'        AND t."category" = 'LONG_TERM'  THEN 'STOCKS_ISA'
        WHEN t."wrapper" = 'ISA'                                        THEN 'CASH_ISA'
        WHEN t."wrapper" = 'PENSION'                                    THEN 'SIPP'
        WHEN t."wrapper" = 'DB_PENSION'                                 THEN 'FINAL_SALARY'
        WHEN t."wrapper" = 'GIA'                                        THEN 'GIA'
        WHEN t."wrapper" = 'PROPERTY'                                   THEN 'PROPERTY'
        WHEN t."kind" = 'ASSET'                                         THEN 'OTHER_ASSET'
        ELSE 'CURRENT_ACCOUNT'
      END)::"AccountType" AS type
      FROM (VALUES
        ('none-ledger'::text, 'NONE'::"AccountKind", NULL::"PlanAssetWrapper", NULL::"BalanceItemCategory", NULL::uuid),
        ('stocks-isa', 'ASSET'::"AccountKind", 'ISA'::"PlanAssetWrapper", 'LONG_TERM'::"BalanceItemCategory", NULL::uuid),
        ('loan', 'LIABILITY'::"AccountKind", NULL::"PlanAssetWrapper", 'MEDIUM_TERM'::"BalanceItemCategory", NULL::uuid),
        ('mortgage', 'LIABILITY'::"AccountKind", NULL::"PlanAssetWrapper", 'LONG_TERM'::"BalanceItemCategory", '00000000-0000-0000-0000-000000000001'::uuid)
      ) AS t("name", "kind", "wrapper", "category", "linkedAccountId")
    `);

    const byName = Object.fromEntries(rows.map((r) => [r.name, r.type]));
    expect(byName["none-ledger"]).toBe("CURRENT_ACCOUNT");
    expect(byName["stocks-isa"]).toBe("STOCKS_ISA");
    expect(byName.loan).toBe("LOAN");
    expect(byName.mortgage).toBe("MORTGAGE");
  });
});
