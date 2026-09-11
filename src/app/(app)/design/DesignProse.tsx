"use client";

import { Fragment, type ReactNode } from "react";
import {
  LegalBody,
  LegalHeading,
  LegalList,
  LegalMinorHeading,
  LegalSubHeading,
  LegalTable,
  LegalTableWrap,
} from "@/components/legal/LegalPage";
import type { Block, Span } from "@/lib/design/markdown";
import { Rule } from "./DesignSystem.styled";

// DESIGN.md's prose, rendered with the same primitives as the other long-form
// pages. Nothing here decides what the document says — the document does.

const renderSpan = (span: Span): ReactNode => {
  if (span.kind === "text") return span.text;
  if (span.kind === "code") return <code>{span.text}</code>;
  if (span.kind === "strong") return <strong>{spans(span.spans)}</strong>;
  return <em>{spans(span.spans)}</em>;
};

// Spans are positional runs of one string, so their index *is* their identity.
const spans = (list: Span[]): ReactNode =>
  list.map((span, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: parsed from a static document — nothing here reorders, and none of it holds state
    <Fragment key={`${index}-${span.kind}`}>{renderSpan(span)}</Fragment>
  ));

const headings = {
  2: LegalHeading,
  3: LegalSubHeading,
  4: LegalMinorHeading,
} as const;

const renderBlock = (block: Block, key: string): ReactNode => {
  if (block.kind === "heading") {
    const Heading = headings[block.level];
    return (
      <Heading id={block.slug} key={key}>
        {block.text}
      </Heading>
    );
  }

  if (block.kind === "paragraph") {
    return <LegalBody key={key}>{spans(block.spans)}</LegalBody>;
  }

  if (block.kind === "list") {
    return (
      <LegalList as={block.isOrdered ? "ol" : "ul"} key={key}>
        {block.items.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: parsed from a static document — nothing here reorders, and none of it holds state
          <li key={`${key}-${index}`}>{spans(item)}</li>
        ))}
      </LegalList>
    );
  }

  if (block.kind === "table") {
    return (
      <LegalTableWrap key={key}>
        <LegalTable>
          <thead>
            <tr>
              {block.head.map((cell, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: parsed from a static document — nothing here reorders, and none of it holds state
                <th key={`${key}-h${index}`}>{spans(cell)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: parsed from a static document — nothing here reorders, and none of it holds state
              <tr key={`${key}-r${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: parsed from a static document — nothing here reorders, and none of it holds state
                  <td key={`${key}-r${rowIndex}c${cellIndex}`}>
                    {spans(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </LegalTable>
      </LegalTableWrap>
    );
  }

  return <Rule key={key} />;
};

export function DesignProse({ blocks }: { blocks: Block[] }) {
  return <>{blocks.map((block, index) => renderBlock(block, `b${index}`))}</>;
}
