// The mixed-schema check: fails a pull request that changes a migration and
// application code together.
//
// See src/lib/ci/mixedSchema.ts for why the rule is shaped this way; this file
// is only the plumbing — read the diff, print the verdict, set the exit code.
//
//   pnpm check:mixed-schema [baseRef]
//
// Runs locally against origin/master by default, so a branch can be checked
// before it is pushed.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  findDestructiveStatements,
  splitChangedFiles,
} from "../src/lib/ci/mixedSchema";

const baseRef = process.argv[2] ?? "origin/master";

// Three dots: the diff against the merge base, so commits that landed on master
// after this branch started are not mistaken for its own changes.
const changed = execFileSync(
  "git",
  ["diff", "--name-only", `${baseRef}...HEAD`],
  { encoding: "utf8" },
)
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const { migrations, code } = splitChangedFiles(changed);

if (migrations.length === 0) {
  console.log("No migrations in this PR — nothing to check.");
  process.exit(0);
}

console.log(`Migrations in this PR (${migrations.length}):`);
for (const file of migrations) console.log(`  ${file}`);

// Reported whether or not the PR passes: a destructive statement is a prompt to
// check that the code which used the old shape is already gone, and separation
// alone does not make one safe.
const destructive = migrations.flatMap((file) => {
  const statements = findDestructiveStatements(readFileSync(file, "utf8"));
  return statements.map((statement) => ({ file, statement }));
});

if (destructive.length > 0) {
  console.log("\nBackward-incompatible statements — expand/contract check:");
  for (const { file, statement } of destructive) {
    console.log(`  ${file}\n    ${statement}`);
  }
  console.log(
    "\n  These break code that predates them, so they belong in a *contract*\n" +
      "  PR — after the code that read the old shape has already shipped.",
  );
}

if (code.length === 0) {
  console.log(
    "\nNo application code alongside them. This migration travels alone.",
  );
  process.exit(0);
}

if (process.env.ALLOW_MIXED_SCHEMA === "true") {
  console.log(
    `\nApplication code present (${code.length} files), but the ` +
      "mixed-schema-ok label is set. Allowing.",
  );
  process.exit(0);
}

console.error("\nRejected: this PR mixes a migration with application code.\n");
for (const file of code) console.error(`  ${file}`);
console.error(
  "\n  Migrations must ship in their own PR, so that whichever of migrate-prod\n" +
    "  and the Vercel deploy lands first, the schema and the code still agree.\n" +
    "\n  Split it: the migration alone first (additive), then the code that uses\n" +
    "  it. If this genuinely has to ship together, add the 'mixed-schema-ok'\n" +
    "  label to say so deliberately.",
);
process.exit(1);
