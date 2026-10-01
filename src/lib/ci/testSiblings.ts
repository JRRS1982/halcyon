// The rule every unit and integration test has to satisfy: it sits beside the
// thing it tests, and says so in its name.
//
// A test is named `<subject>.<topic?>.test.ts(x)` or
// `<subject>.<topic?>.integration.test.ts`, and `<subject>` must be a sibling
// — a file (`actions.ts`, `schema.prisma`) or folder with that name. A
// component folder counts as its own subject: `Button/Button.test.tsx` beside
// `Button/index.tsx`.
//
// Why a rule: a test whose subject is deleted keeps passing — it imports
// nothing that fails to resolve if it only drives a neighbouring module — and
// nothing points at it any more. Tying each test to a named sibling means
// deleting the subject leaves a visible orphan, and this check reports it.
// e2e specs (tests/e2e/) test whole journeys and have no single subject, so
// they are out of scope.

const TEST_FILE = /\.test\.tsx?$/;

const dirOf = (path: string): string =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

const nameOf = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

export function findOrphanTests(paths: string[]): string[] {
  // Every file's directory is also an entry in its parent, so folders can be
  // subjects without the caller listing them separately.
  const entriesByDir = new Map<string, Set<string>>();
  const addEntry = (path: string) => {
    const dir = dirOf(path);
    const entries = entriesByDir.get(dir) ?? new Set<string>();
    entries.add(nameOf(path));
    entriesByDir.set(dir, entries);
  };
  for (const path of paths) {
    addEntry(path);
    for (let dir = dirOf(path); dir !== ""; dir = dirOf(dir)) addEntry(dir);
  }

  return paths.filter((path) => {
    if (!TEST_FILE.test(path)) return false;

    const dir = dirOf(path);
    const subject = nameOf(path).split(".")[0];
    const siblings = [...(entriesByDir.get(dir) ?? [])].filter(
      (entry) => !TEST_FILE.test(entry),
    );

    const hasSibling = siblings.some(
      (entry) => entry === subject || entry.startsWith(`${subject}.`),
    );
    const isFolderSubject =
      nameOf(dir) === subject &&
      siblings.some((entry) => /^index\.tsx?$/.test(entry));

    return !hasSibling && !isFolderSubject;
  });
}
