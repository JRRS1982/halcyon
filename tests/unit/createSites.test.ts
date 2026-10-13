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

const OWNERS: Record<string, string> = {
  "category.create": "src/lib/categories/createWithinCap.ts",
  "account.create": "src/lib/accounts/createWithinCap.ts",
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
  (member, owner) => {
    it(`has no call site outside ${owner}`, () => {
      // `.create(` on the model, however the client is named — prisma, tx, db.
      const pattern = new RegExp(`\\.${member.replace(".", "\\.")}\\(`);

      const offenders = sourceFiles(SRC)
        .filter((file) => relative(file) !== owner)
        .filter((file) => pattern.test(readFileSync(file, "utf8")))
        .map(relative);

      expect(offenders).toEqual([]);
    });
  },
);

// A rule nobody can break because it is also never used is not a rule. If the
// owning file stops creating, this test has stopped guarding anything.
describe("the owning helpers still create", () => {
  it.each(Object.entries(OWNERS))("%s is called in %s", (member, owner) => {
    const source = readFileSync(join(process.cwd(), owner), "utf8");
    const bare = member.split(".")[1] as string;
    expect(source).toMatch(new RegExp(`\\.${bare}\\(`));
  });
});
