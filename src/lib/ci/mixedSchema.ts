// The rule a pull request has to satisfy: a migration never ships alongside
// the code that uses it.
//
// Why a rule rather than a judgement about which SQL is safe: classifying
// statements is a losing game — renames, widening, new NOT NULLs, constraint
// additions and index locks all break a running app in different ways, and the
// taxonomy is never finished. "No code with migrations" is one rule, checkable
// exactly, and it makes the deploy order stop mattering: a migration PR changes
// no application code, so whichever of migrate-and-deploy lands first, the two
// halves agree.
//
// Separation is not the same as safety. A rename in its own PR still breaks the
// live code the moment it applies, because that code predates it — which is why
// destructive statements are still reported, as a prompt rather than a gate.

const MIGRATION_PREFIX = "prisma/migrations/";

// Everything the application actually runs, plus the tests that describe it.
// A migration has no business touching any of it.
const CODE_PREFIXES = ["src/", "e2e/"];

export type ChangedFiles = {
  migrations: string[];
  code: string[];
};

export function splitChangedFiles(paths: string[]): ChangedFiles {
  return {
    migrations: paths.filter((path) => path.startsWith(MIGRATION_PREFIX)),
    // prisma/schema.prisma is deliberately absent: it is the source a
    // migration is generated from, so it travels with one by definition.
    // Docs, workflows and lockfiles are likewise not application code.
    code: paths.filter((path) =>
      CODE_PREFIXES.some((prefix) => path.startsWith(prefix)),
    ),
  };
}

// Statements that make a schema stop being backward compatible — the reason
// deploy order matters at all. Anchored at a statement boundary so a column
// named "drop_table" cannot trip them.
const DESTRUCTIVE = [
  /\bDROP\s+COLUMN\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bRENAME\b/i,
  /\bALTER\s+COLUMN\b[\s\S]*?\bTYPE\b/i,
  /\bSET\s+NOT\s+NULL\b/i,
];

// `-- …` line comments are stripped first: Prisma writes its own commentary
// into migrations, and a warning about a statement nobody runs is noise.
const withoutComments = (sql: string): string =>
  sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");

export function findDestructiveStatements(sql: string): string[] {
  return withoutComments(sql)
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .filter((statement) => DESTRUCTIVE.some((rule) => rule.test(statement)))
    .map((statement) => `${statement};`);
}
