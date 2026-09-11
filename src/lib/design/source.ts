import { readFile } from "node:fs/promises";
import { join } from "node:path";

// /DESIGN.md at the repository root is the design system's single source of
// truth — src/lib/theme.ts and src/lib/palette.ts are its runtime form, and
// /design is its published form. Both read this file rather than restating it,
// so the page a designer reads and the tokens the app ships cannot disagree.
//
// next.config.mjs -> outputFileTracingIncludes ships DESIGN.md alongside the
// /design and /design.md server bundles. Without that entry the read succeeds
// locally, where the whole repo is on disk, and throws ENOENT on Vercel.
const DESIGN_DOC_PATH = join(process.cwd(), "DESIGN.md");

export const DESIGN_DOC_FILENAME = "DESIGN.md";

export const readDesignDoc = (): Promise<string> =>
  readFile(DESIGN_DOC_PATH, "utf8");

/**
 * The file is a YAML token contract inside a leading `---` fence followed by
 * the prose that explains it. The two halves are presented differently — the
 * prose is the page, the contract is a reference appendix — so the reader
 * splits them rather than the page hunting for the boundary itself.
 */
export type DesignDoc = { contract: string; prose: string };

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

export const splitDesignDoc = (raw: string): DesignDoc => {
  const fence = FRONT_MATTER.exec(raw);
  if (!fence) {
    throw new Error(
      "DESIGN.md: expected the token contract in a leading `---` fence",
    );
  }

  return { contract: fence[1] ?? "", prose: raw.slice(fence[0].length) };
};
