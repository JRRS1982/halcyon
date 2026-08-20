// Two halves of the same decision, kept honest against each other.
//
// Prisma's @default only fills a column when the app omits it on insert; the
// Postgres DEFAULT is what applies when a row is created any other way. If the
// schema and the migration disagree, new users get the feature in one code
// path and not the other — a difference nothing else in the test suite would
// notice.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PRISMA_DIR = join(process.cwd(), "prisma");

const schema = () => readFileSync(join(PRISMA_DIR, "schema.prisma"), "utf8");

const allMigrationSql = (): string =>
  readdirSync(join(PRISMA_DIR, "migrations"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) =>
      readFileSync(
        join(PRISMA_DIR, "migrations", entry.name, "migration.sql"),
        "utf8",
      ),
    )
    .join("\n");

describe("transactions is on for new accounts", () => {
  test("the schema defaults transactionsEnabled to true", () => {
    expect(schema()).toMatch(
      /transactionsEnabled\s+Boolean\s+@default\(true\)/,
    );
  });

  test("a migration sets the same default in Postgres", () => {
    expect(allMigrationSql()).toMatch(
      /ALTER COLUMN "transactionsEnabled" SET DEFAULT true/,
    );
  });

  // The flip is for accounts created from here on. Back-filling would switch
  // the feature on for people who had deliberately turned it off.
  //
  // Scoped to a single statement ([^;]*): matching across the whole
  // concatenated file would flag the unrelated currency backfill in
  // 20260621120000_set_currency_default_gbp simply because the word appears
  // in some later migration.
  test("no migration force-enables it for existing rows", () => {
    expect(allMigrationSql()).not.toMatch(
      /UPDATE\s+"UserSettings"[^;]*transactionsEnabled[^;]*;/i,
    );
  });
});
