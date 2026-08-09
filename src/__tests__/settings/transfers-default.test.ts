// The same schema-vs-migration pairing as transactions-default.test.ts, for
// the other feature flag.
//
// Prisma's @default only fills a column when the app omits it on insert; the
// Postgres DEFAULT is what applies when a row is created any other way. If the
// schema and the migration disagree, new users get the feature in one code
// path and not the other — a difference nothing else in the test suite would
// notice.
//
// Where the two flags differ is the back-fill: transactions was left alone for
// existing rows, transfers is switched on for everyone. Netting transfers out
// of income and expenses corrects a reading rather than revealing anything, so
// the third test here is the mirror image of its counterpart — it asserts the
// UPDATE is present rather than absent.
import { readFileSync, readdirSync } from "node:fs";
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

describe("transfers is on by default", () => {
  test("the schema defaults transfersEnabled to true", () => {
    expect(schema()).toMatch(/transfersEnabled\s+Boolean\s+@default\(true\)/);
  });

  test("a migration sets the same default in Postgres", () => {
    expect(allMigrationSql()).toMatch(
      /ALTER COLUMN "transfersEnabled" SET DEFAULT true/,
    );
  });

  // Scoped to a single statement ([^;]*) so an unrelated UPDATE elsewhere in
  // the concatenated migrations can't satisfy this by coincidence.
  test("a migration switches it on for existing rows too", () => {
    expect(allMigrationSql()).toMatch(
      /UPDATE\s+"UserSettings"[^;]*"transfersEnabled"\s*=\s*true[^;]*;/i,
    );
  });
});
