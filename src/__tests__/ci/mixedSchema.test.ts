import {
  findDestructiveStatements,
  splitChangedFiles,
} from "@/lib/ci/mixedSchema";

describe("splitChangedFiles", () => {
  test("a code-only change carries no migration", () => {
    const split = splitChangedFiles(["src/app/page.tsx", "docs/readme.md"]);
    expect(split.migrations).toEqual([]);
    expect(split.code).toEqual(["src/app/page.tsx"]);
  });

  test("a migration brings its schema with it, and neither is code", () => {
    // schema.prisma always moves with a migration — it is the source the
    // migration was generated from, not a separate change.
    const split = splitChangedFiles([
      "prisma/migrations/20260101000000_add_thing/migration.sql",
      "prisma/schema.prisma",
    ]);
    expect(split.migrations).toHaveLength(1);
    expect(split.code).toEqual([]);
  });

  test("e2e specs count as code — a migration has no business changing them", () => {
    const split = splitChangedFiles([
      "prisma/migrations/20260101000000_add_thing/migration.sql",
      "e2e/budget.spec.ts",
    ]);
    expect(split.code).toEqual(["e2e/budget.spec.ts"]);
  });

  test("docs, workflows and lockfiles may travel with a migration", () => {
    const split = splitChangedFiles([
      "prisma/migrations/20260101000000_add_thing/migration.sql",
      "docs/features/budget.md",
      "CLAUDE.md",
      ".github/workflows/ci.yml",
      "pnpm-lock.yaml",
    ]);
    expect(split.code).toEqual([]);
  });

  test("tests are code too, so a migration cannot smuggle one in", () => {
    const split = splitChangedFiles([
      "prisma/migrations/20260101000000_add_thing/migration.sql",
      "src/__tests__/budget/thing.test.ts",
    ]);
    expect(split.code).toEqual(["src/__tests__/budget/thing.test.ts"]);
  });
});

describe("findDestructiveStatements", () => {
  test("an additive migration is not destructive", () => {
    expect(
      findDestructiveStatements(
        'ALTER TABLE "BudgetItem" ADD COLUMN "notes" TEXT;',
      ),
    ).toEqual([]);
  });

  test("dropping a column is destructive", () => {
    expect(
      findDestructiveStatements('ALTER TABLE "Plan" DROP COLUMN "rate";'),
    ).toEqual(['ALTER TABLE "Plan" DROP COLUMN "rate";']);
  });

  test("a rename is destructive — the column vanishes under the running code", () => {
    // The case that makes separation alone insufficient: old code still reads
    // the old name the instant the migration lands.
    expect(
      findDestructiveStatements(
        'ALTER TABLE "Category" RENAME COLUMN "kind" TO "section";',
      ),
    ).toHaveLength(1);
  });

  test("tightening a column is destructive", () => {
    expect(
      findDestructiveStatements(
        'ALTER TABLE "A" ALTER COLUMN "b" SET NOT NULL;',
      ),
    ).toHaveLength(1);
    expect(
      findDestructiveStatements(
        'ALTER TABLE "A" ALTER COLUMN "b" TYPE INTEGER;',
      ),
    ).toHaveLength(1);
    expect(findDestructiveStatements('DROP TABLE "Old";')).toHaveLength(1);
  });

  test("a commented-out drop is not a drop", () => {
    expect(
      findDestructiveStatements(
        '-- DROP COLUMN "rate" was considered here\nALTER TABLE "A" ADD COLUMN "b" TEXT;',
      ),
    ).toEqual([]);
  });

  test("matching ignores case and reports every statement", () => {
    const found = findDestructiveStatements(
      'alter table "A" drop column "x";\nDROP TABLE "B";',
    );
    expect(found).toHaveLength(2);
  });
});
