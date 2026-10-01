import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { findOrphanTests } from "@/lib/ci/testSiblings";

describe("findOrphanTests", () => {
  test("a test beside its subject file is not an orphan", () => {
    expect(
      findOrphanTests([
        "src/lib/budget/period.ts",
        "src/lib/budget/period.test.ts",
      ]),
    ).toEqual([]);
  });

  test("the subject is the first segment, so a topic may follow it", () => {
    expect(
      findOrphanTests([
        "src/app/plan/actions.ts",
        "src/app/plan/actions.createPlan.integration.test.ts",
      ]),
    ).toEqual([]);
  });

  test("any extension counts — the schema is a subject too", () => {
    expect(
      findOrphanTests([
        "prisma/schema.prisma",
        "prisma/schema.planLinks.integration.test.ts",
      ]),
    ).toEqual([]);
  });

  test("a component folder is its own subject", () => {
    expect(
      findOrphanTests([
        "src/components/ui/Button/index.tsx",
        "src/components/ui/Button/Button.test.tsx",
      ]),
    ).toEqual([]);
  });

  test("a test whose subject was deleted is an orphan", () => {
    expect(
      findOrphanTests([
        "src/lib/plan/project.ts",
        "src/lib/plan/dbPension.test.ts",
      ]),
    ).toEqual(["src/lib/plan/dbPension.test.ts"]);
  });

  test("another test does not count as a subject", () => {
    expect(
      findOrphanTests([
        "src/lib/plan/project.test.ts",
        "src/lib/plan/project.dbPension.test.ts",
      ]),
    ).toEqual([
      "src/lib/plan/project.test.ts",
      "src/lib/plan/project.dbPension.test.ts",
    ]);
  });
});

// The rule applied to the real tree. Everything a unit or integration test can
// live in; tests/ holds e2e specs and the integration harness, which have no
// single subject.
const SCANNED = ["src", "prisma"];

const filesUnder = (dir: string): string[] =>
  readdirSync(join(process.cwd(), dir), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(process.cwd(), join(entry.parentPath, entry.name)),
    );

test("every test in the repo sits beside the subject it is named after", () => {
  expect(findOrphanTests(SCANNED.flatMap(filesUnder))).toEqual([]);
});
