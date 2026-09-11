// A markdown reader for exactly one document: /DESIGN.md.
//
// The design page renders the same file the components are built against, so
// the file has to be parsed at read time rather than transcribed into JSX — a
// second copy is the drift the page exists to prevent. That job is narrow
// enough not to be worth a markdown library: DESIGN.md uses five block shapes
// and three inline ones, all of them below.
//
// The parser is deliberately strict. Anything it does not recognise throws
// rather than degrading to literal text, and designDoc.test.ts parses the real
// file — so introducing a construct this does not cover fails the build
// instead of rendering a broken page in production.

/** Inline runs. `code` is a leaf; emphasis nests, because DESIGN.md writes **`token`**. */
export type Span =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; spans: Span[] }
  | { kind: "em"; spans: Span[] };

export type HeadingLevel = 2 | 3 | 4;

export type Block =
  | { kind: "heading"; level: HeadingLevel; slug: string; text: string }
  | { kind: "paragraph"; spans: Span[] }
  | { kind: "list"; isOrdered: boolean; items: Span[][] }
  | { kind: "table"; head: Span[][]; rows: Span[][][] }
  | { kind: "rule" };

// Code first: a backtick run wins over the emphasis markers, so a `*` inside a
// token name stays literal. Emphasis captures raw text which is then re-parsed,
// which is what turns **`nav-bar`** into a strong code span rather than a
// strong span with visible backticks.
const INLINE = /`([^`]+)`|\*\*([^*]+?)\*\*|\*([^*\s][^*]*?)\*/g;

const HEADING = /^(#{2,4}) +(.*)$/;
const BULLET = /^[-*] +(.*)$/;
const ORDERED = /^\d+\. +(.*)$/;
const RULE = /^-{3,}$/;
const TABLE_DIVIDER = /^\|[\s:|-]+\|$/;
// Opening lines of the shapes this reader does not render: h1 and h5+, fenced
// code, blockquotes, and anything indented (a nested list or an indented code
// block). Checked only where a block starts — an indented line *inside* a
// block is an ordinary wrapped continuation.
const UNSUPPORTED = /^(#(?!#{1,3} )|#{5,}|```|>|\s+\S)/;

const isTableRow = (line: string) => line.startsWith("|");

const startsBlock = (line: string) =>
  line.trim() === "" ||
  RULE.test(line) ||
  HEADING.test(line) ||
  isTableRow(line) ||
  BULLET.test(line) ||
  ORDERED.test(line);

const lineAt = (lines: string[], index: number) => lines[index] ?? "";

export const parseInline = (source: string): Span[] => {
  const spans: Span[] = [];
  let cursor = 0;

  for (const match of source.matchAll(INLINE)) {
    const whole = match[0] ?? "";
    const at = match.index ?? 0;

    if (at > cursor) {
      spans.push({ kind: "text", text: source.slice(cursor, at) });
    }

    const [, code, strong, em] = match;
    if (code !== undefined) spans.push({ kind: "code", text: code });
    else if (strong !== undefined) {
      spans.push({ kind: "strong", spans: parseInline(strong) });
    } else if (em !== undefined) {
      spans.push({ kind: "em", spans: parseInline(em) });
    }

    cursor = at + whole.length;
  }

  if (cursor < source.length) {
    spans.push({ kind: "text", text: source.slice(cursor) });
  }

  return spans;
};

/** Anchor ids for the contents list. Deliberately dumb, and stable across builds. */
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const splitRow = (line: string): string[] =>
  line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

/**
 * A block's opening content plus every lazy continuation after it: markdown
 * lets a paragraph or list item wrap without indentation, and DESIGN.md does.
 * `from` is the index of the line after the opening one.
 */
const takeContinued = (
  head: string,
  lines: string[],
  from: number,
): [string, number] => {
  const parts = [head.trim()];
  let index = from;

  while (index < lines.length && !startsBlock(lineAt(lines, index))) {
    parts.push(lineAt(lines, index).trim());
    index += 1;
  }

  return [parts.join(" "), index];
};

const takeList = (lines: string[], from: number): [Block, number] => {
  const marker = ORDERED.test(lineAt(lines, from)) ? ORDERED : BULLET;
  const items: Span[][] = [];
  let index = from;

  while (index < lines.length) {
    const item = marker.exec(lineAt(lines, index));
    if (!item) break;

    const [text, next] = takeContinued(item[1] ?? "", lines, index + 1);
    items.push(parseInline(text));
    index = next;
  }

  return [{ kind: "list", isOrdered: marker === ORDERED, items }, index];
};

const takeTable = (lines: string[], from: number): [Block, number] => {
  if (!TABLE_DIVIDER.test(lineAt(lines, from + 1))) {
    throw new Error(
      `DESIGN.md line ${from + 2}: table header is not followed by a |---| divider row`,
    );
  }

  const head = splitRow(lineAt(lines, from)).map(parseInline);
  const rows: Span[][][] = [];
  let index = from + 2;

  while (index < lines.length && isTableRow(lineAt(lines, index))) {
    rows.push(splitRow(lineAt(lines, index)).map(parseInline));
    index += 1;
  }

  return [{ kind: "table", head, rows }, index];
};

export const parseMarkdown = (source: string): Block[] => {
  const lines = source.split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lineAt(lines, index);

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const text = (heading[2] ?? "").trim();
      blocks.push({
        kind: "heading",
        level: (heading[1] ?? "##").length as HeadingLevel,
        slug: slugify(text),
        text,
      });
      index += 1;
      continue;
    }

    if (isTableRow(line)) {
      const [table, next] = takeTable(lines, index);
      blocks.push(table);
      index = next;
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const [list, next] = takeList(lines, index);
      blocks.push(list);
      index = next;
      continue;
    }

    // Naming the offending line beats a generic "cannot parse": the fix is
    // either to change the document or to teach this file the shape, and the
    // message should make clear which shapes are on offer.
    if (UNSUPPORTED.test(line)) {
      throw new Error(
        `DESIGN.md line ${index + 1}: unsupported markdown ${JSON.stringify(
          line.slice(0, 40),
        )}. The design page renders h2-h4, paragraphs, lists, tables and rules only.`,
      );
    }

    const [text, next] = takeContinued(line, lines, index + 1);
    blocks.push({ kind: "paragraph", spans: parseInline(text) });
    index = next;
  }

  return blocks;
};
