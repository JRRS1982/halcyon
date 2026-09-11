"use client";

import { LegalBody } from "@/components/legal/LegalPage";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Block } from "@/lib/design/markdown";
import { swatchGroups } from "@/lib/design/swatches";
import { cssVariableName, darkPalette, lightPalette } from "@/lib/palette";
import { theme } from "@/lib/theme";
import { DesignProse } from "./DesignProse";
import {
  Board,
  BoardTitle,
  Chip,
  Contents,
  ContentsLink,
  Contract,
  ContractSource,
  DesignShell,
  HexRow,
  Mono,
  Panel,
  PanelTitle,
  Prose,
  Specimen,
  SpecimenSample,
  SpecimenSize,
  Specimens,
  Swatch,
  SwatchGrid,
  SwatchMeta,
  TokenName,
} from "./DesignSystem.styled";

// The published form of /DESIGN.md.
//
// Everything below the header is generated from two sources and nothing else:
// the document itself, and the token modules the application renders with
// (palette.ts, theme.ts). There is no third copy of the design system on this
// page to fall out of step with the first two — a swatch shows the live custom
// property, and a type specimen is set in the token it names.

type Typography = typeof theme.typography;
type TypographyToken = keyof Typography;

// One sample per type token. A total map, so a new token in theme.ts fails
// typecheck here rather than quietly missing from the specimen board.
const SAMPLES: Record<TypographyToken, string> = {
  displayXl: "Budget overview",
  displayLg: "Historic records",
  bodyMd: "Every amount in this sheet is yours to edit.",
  bodyMdStrong: "Emphasis inside body text",
  amount: "£1,240.00",
  amountStrong: "£8,500.00",
  amountXl: "£124,806.32",
  monoCaps: "Category · Jan 2026 · Locked",
};

const sampleStyle = (token: Typography[TypographyToken]) => ({
  fontFamily: token.family,
  fontSize: token.size,
  fontWeight: token.weight,
  lineHeight: token.lineHeight,
  letterSpacing: token.letterSpacing,
  textTransform: "textTransform" in token ? token.textTransform : undefined,
});

type DesignSystemProps = {
  blocks: Block[];
  contract: string;
  rawUrl: string;
};

export function DesignSystem({ blocks, contract, rawUrl }: DesignSystemProps) {
  // flatMap rather than filter: the narrowing survives, so the contents list
  // can read .slug and .text without a cast.
  const sections = blocks.flatMap((block) =>
    block.kind === "heading" && block.level === 2 ? [block] : [],
  );
  const typeTokens = Object.keys(theme.typography) as TypographyToken[];

  return (
    <DesignShell>
      <PageHeader
        eyebrow="Design system"
        title="Balanced Money design system"
        lead="Everything on this page is rendered from DESIGN.md in the repository — the same file the components are built against — so it cannot go out of date while the app moves on."
      />

      <Panel>
        <PanelTitle>How to use it</PanelTitle>
        <LegalBody>
          <strong>Reading it:</strong> the swatches and type specimens below are
          live — each swatch is filled with the custom property the app is
          running right now, and each specimen is set in the token it names, in
          whichever colour scheme you are viewing.
        </LegalBody>
        <LegalBody>
          <strong>Building with it:</strong> point the tool at the file rather
          than pasting a copy into a prompt — a pasted copy is stale the next
          time a token changes. The raw markdown is at <Mono>{rawUrl}</Mono>.
        </LegalBody>
      </Panel>

      <Contents aria-label="Sections">
        {sections.map((section) => (
          <ContentsLink href={`#${section.slug}`} key={section.slug}>
            {section.text}
          </ContentsLink>
        ))}
      </Contents>

      {swatchGroups().map((group) => (
        <Board key={group.name}>
          <BoardTitle>{group.title}</BoardTitle>
          <LegalBody>{group.blurb}</LegalBody>
          <SwatchGrid>
            {group.tokens.map((token) => (
              <Swatch key={token}>
                <Chip
                  style={{ background: `var(${cssVariableName(token)})` }}
                />
                <SwatchMeta>
                  <TokenName>{token}</TokenName>
                  <HexRow>
                    <dt>Light</dt>
                    <dd>{lightPalette[token]}</dd>
                    <dt>Dark</dt>
                    <dd>{darkPalette[token]}</dd>
                  </HexRow>
                </SwatchMeta>
              </Swatch>
            ))}
          </SwatchGrid>
        </Board>
      ))}

      <Board>
        <BoardTitle>Type</BoardTitle>
        <LegalBody>
          Five sizes carry the whole system — 28, 18, 14, 13 and 11 px. Each row
          below is set in the token it names.
        </LegalBody>
        <Specimens>
          {typeTokens.map((token) => (
            <Specimen key={token}>
              <SpecimenSize>
                {theme.typography[token].size} · {token}
              </SpecimenSize>
              <SpecimenSample style={sampleStyle(theme.typography[token])}>
                {SAMPLES[token]}
              </SpecimenSample>
            </Specimen>
          ))}
        </Specimens>
      </Board>

      <Prose>
        <DesignProse blocks={blocks} />
      </Prose>

      <Contract>
        <summary>The full token contract</summary>
        <ContractSource>{contract}</ContractSource>
      </Contract>
    </DesignShell>
  );
}
