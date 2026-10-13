import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Guards a rule that is otherwise only a habit.
//
// Every cap defect in this codebase has had the same shape: a ceiling defined
// once, enforced at the call sites someone thought of, and silently absent from
// the rest. Categories had four create sites and one check. Accounts had four
// and two, both inside the same transaction. The constants read like rules
// while most paths walked past them, and each round of fixes capped the paths
// that were named rather than the ones that existed.
//
// A guard you have to remember to call will eventually not be called. So the
// capped helpers own the create, and this test fails the build if a new one
// appears anywhere else — including in a file nobody thought to audit.
//
// Deliberately a source scan rather than a lint rule: Biome has no way to say
// "this member call is allowed in exactly one file", and a test states the
// reason in the place the failure is read.
const SRC = join(process.cwd(), "src");

// model -> the one file allowed to create it.
const OWNERS: Record<string, string> = {
  category: "src/lib/categories/createWithinCap.ts",
  account: "src/lib/accounts/createWithinCap.ts",
  budgetItem: "src/lib/budget/createWithinCap.ts",
  balanceItem: "src/lib/balance/createWithinCap.ts",
  planAsset: "src/lib/plan/createWithinCap.ts",
  planLiability: "src/lib/plan/createWithinCap.ts",
  planIncome: "src/lib/plan/createWithinCap.ts",
  planExpense: "src/lib/plan/createWithinCap.ts",
  planEvent: "src/lib/plan/createWithinCap.ts",
};

// Every way Prisma writes a new row, not just .create(. The first version of
// this test matched .create( alone, which left createMany, upsert and
// connectOrCreate invisible to it — the next bulk write would have landed
// uncapped with a green build, which is how this defect started.
const WRITES = "create|createMany|createManyAndReturn|upsert";

// Provisioning seeds fixed arrays once per user behind a race gate, so it
// cannot be looped. Named here rather than left silently matching, so the
// exception is something a reader can see and argue with.
const ALLOWED: Record<string, string[]> = {
  category: ["src/lib/settings/server.ts"],
  account: ["src/lib/settings/server.ts"],
  budgetItem: ["src/lib/settings/server.ts"],
  // Sync is all-or-nothing: it has to know the whole batch fits before it
  // writes any of it, so a run that would breach the ceiling fails before
  // touching the plan rather than stopping half way. assertRoomForAdditions
  // does that, against both ceilings, for every kind it is about to add — so
  // this file is capped, just not one row at a time.
  planAsset: ["src/lib/plan/applySyncPlan.ts"],
  planLiability: ["src/lib/plan/applySyncPlan.ts"],
  planIncome: ["src/lib/plan/applySyncPlan.ts"],
  planExpense: ["src/lib/plan/applySyncPlan.ts"],
};

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
  });

const relative = (path: string) =>
  path.slice(process.cwd().length + 1).replaceAll("\\", "/");

describe.each(Object.entries(OWNERS))(
  "%s is created in one place",
  (model, owner) => {
    it(`has no write site outside ${owner}`, () => {
      // However the client is named — prisma, tx, db.
      const pattern = new RegExp(`\\.${model}\\.(${WRITES})\\(`);
      const allowed = new Set([owner, ...(ALLOWED[model] ?? [])]);

      const offenders = sourceFiles(SRC)
        .filter((file) => !allowed.has(relative(file)))
        .filter((file) => pattern.test(readFileSync(file, "utf8")))
        .map(relative);

      expect(offenders).toEqual([]);
    });

    // A nested write reaches the same table without naming the delegate.
    it(`has no nested relation write outside ${owner}`, () => {
      const nested = new RegExp(
        `\\b${model}:\\s*\\{[^}]*\\b(create|connectOrCreate)\\b`,
        "s",
      );
      const allowed = new Set([owner, ...(ALLOWED[model] ?? [])]);

      const offenders = sourceFiles(SRC)
        .filter((file) => !allowed.has(relative(file)))
        .filter((file) => nested.test(readFileSync(file, "utf8")))
        .map(relative);

      expect(offenders).toEqual([]);
    });
  },
);

// A rule nobody can break because it is also never used is not a rule. If the
// owning file stops creating, this test has stopped guarding anything.
// A rule nobody can break because nothing uses it has stopped guarding
// anything. The owners write through a structural delegate rather than a named
// model — one helper serves all five plan kinds that way — so this asserts the
// write and the ceiling are both still there, not which table they reach.
describe("the owning helpers still create, and still check", () => {
  it.each([...new Set(Object.values(OWNERS))])("%s writes", (owner) => {
    const source = readFileSync(join(process.cwd(), owner), "utf8");
    expect(source).toMatch(/\b(create|createMany)\(/);
  });

  it.each([...new Set(Object.values(OWNERS))])(
    "%s checks both ceilings",
    (owner) => {
      const source = readFileSync(join(process.cwd(), owner), "utf8");
      expect(source).toMatch(/assertRoom\(/);
      expect(source).toMatch(/countLive:/);
      expect(source).toMatch(/countStored:/);
    },
  );
});
