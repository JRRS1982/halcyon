// Guards the one security step Prisma cannot express.
//
// `prisma migrate dev` generates DDL from schema.prisma, which has no concept
// of row level security — so every RLS block in prisma/migrations/ was written
// by hand after generating the migration. That manual step is invisible from
// the app side: server-side Prisma connects with a role that BYPASSES RLS
// (ADR-002), so a table with no policy behaves identically in every test and
// every page. The only thing that notices is the Supabase Data API, which
// reaches the same tables over HTTPS without touching this codebase — and there
// `anon`/`authenticated` hold full grants on the public schema, so a missing
// policy means the table is world-readable and world-writable.
//
// That is exactly how Transaction/Account/Category/ImportBatch shipped without
// policies. This test fails the build instead of waiting for an advisor.
//
// Deliberately static (reads the migration SQL, does not query Postgres): the
// RLS blocks are wrapped in `IF EXISTS (... nspname = 'auth')` so they are
// skipped on local Docker Postgres, which means a live pg_tables assertion
// could never pass locally.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PRISMA_DIR = join(process.cwd(), "prisma");
const MIGRATIONS_DIR = join(PRISMA_DIR, "migrations");

// Model name === table name throughout this schema (no @@map), so the model
// list doubles as the list of tables that must be fenced.
const modelNames = (): string[] => {
  const schema = readFileSync(join(PRISMA_DIR, "schema.prisma"), "utf8");
  return [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(
    ([, name]) => name as string,
  );
};

const allMigrationSql = (): string =>
  readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(MIGRATIONS_DIR, entry.name, "migration.sql"))
    .filter(existsSync)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

// `public.` is optional because both spellings appear across the migrations.
const enablesRls = (sql: string, table: string): boolean =>
  new RegExp(
    `ALTER TABLE\\s+(?:public\\.)?"${table}"\\s+ENABLE ROW LEVEL SECURITY`,
    "i",
  ).test(sql);

const hasPolicy = (sql: string, table: string): boolean =>
  new RegExp(
    `CREATE POLICY\\s+"[^"]+"\\s+ON\\s+(?:public\\.)?"${table}"`,
    "i",
  ).test(sql);

describe("row level security", () => {
  const sql = allMigrationSql();
  const models = modelNames();

  it("finds models to check", () => {
    expect(models.length).toBeGreaterThan(0);
    expect(sql.length).toBeGreaterThan(0);
  });

  // RLS on with no policy is deny-all — safe, but it locks the Data API out
  // entirely rather than scoping it to the owner, so both are required.
  it.each(models)("%s has row level security enabled", (model) => {
    expect(enablesRls(sql, model)).toBe(true);
  });

  it.each(models)("%s has an owner policy", (model) => {
    expect(hasPolicy(sql, model)).toBe(true);
  });
});
