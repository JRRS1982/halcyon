"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import styled, { css } from "styled-components";

// Narrow enough that the container *is* the measure. At 820px the paragraphs
// stopped at their own 68ch limit while the step rules and panel borders ran on
// to the full width, so every step ended in a ragged strip of empty page. Sized
// so a comfortable line length fills the column edge to edge instead — and the
// two-column panel grid (260px minimum) still fits.
const Shell = styled.main`
  max-width: 680px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};

  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
`;

const Section = styled.section`
  margin-top: ${({ theme }) => theme.spacing["3xl"]};
`;

const SectionTitle = styled.h2`
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  font-family: ${({ theme }) => theme.typography.displayLg.family};
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  letter-spacing: ${({ theme }) => theme.typography.displayLg.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
`;

const Body = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.body};
`;

// Numbered steps. The marker is the mono-caps voice used for everything
// technical in the system, so the sequence reads as procedure, not prose.
const Steps = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  counter-reset: step;
  border-top: 1px solid ${({ theme }) => theme.colors.hairline};
`;

// The number used to sit in a 32px gutter, which pushed every step's text
// right of the prose above it — two left edges on one page, for no reason.
// The counter now leads the title line instead, so the steps share the
// paragraphs' margin and the page has a single spine.
const Step = styled.li`
  ${({ theme }) => css`
    counter-increment: step;
    padding: ${theme.spacing.lg} 0;
    border-bottom: 1px solid ${theme.colors.hairline};
  `}
`;

const StepTitle = styled.h3`
  ${({ theme }) => css`
    &::before {
      content: counter(step) ". ";
      font-family: ${theme.typography.monoCaps.family};
      letter-spacing: ${theme.typography.monoCaps.letterSpacing};
      color: ${theme.colors.dim};
    }
  `}
  margin: 0 0 ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.typography.bodyMdStrong.family};
  font-size: ${({ theme }) => theme.typography.bodyMdStrong.size};
  font-weight: ${({ theme }) => theme.typography.bodyMdStrong.weight};
  color: ${({ theme }) => theme.colors.ink};
`;

const StepBody = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.body};
`;

const Grid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
`;

const Panel = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
`;

const PanelTitle = styled.h3`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.body};
`;

const PanelBody = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.body};
`;

const InlineLink = styled(Link)`
  color: ${({ theme }) => theme.colors.accent};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.xl};
`;

const PillLink = styled(Link)`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    background: ${theme.colors.primary};
    color: ${theme.colors.onPrimary};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    text-transform: uppercase;
    text-decoration: none;

    &:hover {
      opacity: 0.85;
    }

    @media (max-width: 767px) {
      min-height: 44px;
    }
  `}
`;

const OutlineLink = styled(PillLink)`
  ${({ theme }) => css`
    background: ${theme.colors.canvas};
    color: ${theme.colors.ink};
    border: 1px solid ${theme.colors.hairline};

    &:hover {
      opacity: 1;
      border-color: ${theme.colors.ink};
    }
  `}
`;

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Transactions",
    body: "Where your real spending arrives. Export a CSV from your bank, drop it in, and tag each row with a category. Imports come in batches you can undo, and duplicate rows are spotted for you.",
  },
  {
    title: "Budget",
    body: "What you meant to spend, month by month, split into Fixed, Variable and Discretionary. Once transactions are categorised, the actual column fills itself in beside your plan.",
  },
  {
    title: "Balance",
    body: "What you own and what you owe, sorted by how soon it matters — current, medium-term and long-term. The bottom line is your net worth.",
  },
  {
    title: "Dashboard",
    body: "The read-only view. Cash flow, savings rate, spending by category and net worth over time — all of it drawn from the months you've filled in elsewhere.",
  },
  {
    title: "Plan",
    body: "The long view. Project income, spending, property and pensions decades ahead to see whether the money lasts. Independent of your month-to-month figures.",
  },
  {
    title: "Settings",
    body: "Currency and number format, which charts appear, your categories and accounts — plus a full export of your data and a permanent delete, whenever you want them.",
  },
];

export function Guide() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Guide"
        title="How Balanced Money works"
        lead="Five minutes here will save you a lot of poking around. This page stays put — come back whenever something isn't behaving the way you expected."
      />

      <Section>
        <SectionTitle>The idea</SectionTitle>
        <Body>
          Most people trying to get a grip on their money end up building a
          spreadsheet, then quietly abandoning it around month three. Balanced
          Money is that spreadsheet with the boring parts already done: the
          structure, the formulas, and the charts.
        </Body>
        <Body>
          You still bring the numbers. What you don't have to do is decide how
          to organise them.
        </Body>
      </Section>

      <Section>
        <SectionTitle>The rhythm</SectionTitle>
        <Body>
          Five steps, always in this order. The order is the part that matters;
          how often you sit down is up to you.
        </Body>
        <Body>
          Once a month is the natural fit, because that's how bank statements
          arrive and how the budget and balance sheets are laid out. But every
          few months works too — you'll just have more rows to categorise in one
          go, and the gaps will show as flat stretches in the charts. The first
          pass takes a while; after that it's about ten minutes each time.
        </Body>
        <Steps>
          <Step>
            <StepTitle>Import last month's statement</StepTitle>
            <StepBody>
              Download a CSV from your bank and drop it into{" "}
              <InlineLink href="/transactions">Transactions</InlineLink>. Rows
              you've already imported are detected and skipped, so overlapping
              exports are safe. If it goes wrong, the whole batch can be undone
              in one click.
            </StepBody>
          </Step>
          <Step>
            <StepTitle>Categorise what came in</StepTitle>
            <StepBody>
              Give each row a category. Filter to "uncategorised only" and work
              down the list; select several rows and set them together when
              they're all the same. This is the step everything else depends on
              — an uncategorised transaction is invisible to your budget and
              your charts.
            </StepBody>
          </Step>
          <Step>
            <StepTitle>Read the budget</StepTitle>
            <StepBody>
              Open <InlineLink href="/budget">Budget</InlineLink> and compare
              the two columns. Budget is what you intended; Actual is what the
              statement says. The gap is the interesting part — and it's usually
              in Discretionary.
            </StepBody>
          </Step>
          <Step>
            <StepTitle>Update your balances</StepTitle>
            <StepBody>
              On <InlineLink href="/balance">Balance</InlineLink>, put in this
              month's figures for your accounts, investments, property and
              debts. It's the one bit of manual typing that stays manual — and
              it's what makes the net-worth trend real rather than guessed.
            </StepBody>
          </Step>
          <Step>
            <StepTitle>Look at the dashboard</StepTitle>
            <StepBody>
              <InlineLink href="/dashboard">Dashboard</InlineLink> needs no
              input — it's built from the four steps above. One month tells you
              little. Six months tells you almost everything.
            </StepBody>
          </Step>
        </Steps>
      </Section>

      <Section>
        <SectionTitle>What each section is for</SectionTitle>
        <Grid>
          {SECTIONS.map((section) => (
            <Panel key={section.title}>
              <PanelTitle>{section.title}</PanelTitle>
              <PanelBody>{section.body}</PanelBody>
            </Panel>
          ))}
        </Grid>
      </Section>

      <Section>
        <SectionTitle>How the pieces feed each other</SectionTitle>
        <Body>
          There's one direction of flow worth remembering:{" "}
          <strong>
            transactions fill the budget, and the budget and balance fill the
            dashboard.
          </strong>{" "}
          Categorise a transaction and it lands in the matching budget row's
          Actual column; the dashboard then draws its cash-flow and
          spending-by-category charts from those figures.
        </Body>
        <Body>
          Which is why an empty dashboard is almost never a bug. It means the
          months behind it are empty — or the transactions are in, but nobody
          has told them what they are.
        </Body>
        <Body>
          Balance is the exception: it stands alone. Nothing populates it
          automatically, and nothing else depends on it except the net-worth
          charts.
        </Body>
      </Section>

      <Section>
        <SectionTitle>Your data</SectionTitle>
        <Body>
          Balanced Money never connects to your bank. There's no Open Banking
          link and no third party with read access to your accounts — the only
          way figures get in is a CSV you export yourself, or typing.
        </Body>
        <Body>
          Everything you've entered can be exported as JSON from{" "}
          <InlineLink href="/settings">Settings</InlineLink>, and deleting your
          account really deletes it — rows removed, not flagged.
        </Body>
      </Section>

      <Actions>
        <PillLink href="/transactions">Import a statement</PillLink>
        <OutlineLink href="/budget">Start with a budget</OutlineLink>
      </Actions>
    </Shell>
  );
}
