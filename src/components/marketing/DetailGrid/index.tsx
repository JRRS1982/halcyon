import { SectionHeading } from "@/components/marketing/SectionHeading";
import { Cell, Grid, Key, Section, Text } from "./DetailGrid.styled";

const DETAILS: { key: string; text: string }[] = [
  {
    key: "Transfers aren't spending",
    text: "Move money between your own accounts and Balanced treats it as a transfer, not spending — so your expenditure stays honest and you don't look poorer or richer than you are.",
  },
  {
    key: "Live & in sync",
    text: 'Edit or import a transaction and every chart, total and budget recalculates instantly — no refresh, no stale numbers, no "recalculate" button.',
  },
  {
    key: "Duplicate-safe imports",
    text: "Re-import an overlapping statement and Balanced spots the rows you already have, so nothing gets counted twice.",
  },
  {
    key: "Reversible imports",
    text: "Imported the wrong file? Undo the entire import in one action — the ledger snaps back to exactly where it was.",
  },
  {
    key: "Notes & original detail",
    text: "Add a note to any transaction and keep the original statement details beside the tidy, categorised version.",
  },
  {
    key: "Your data, yours",
    text: "Export everything to a file, clear your data, or delete your account outright — no dark patterns, no hostage-taking.",
  },
];

export function DetailGrid() {
  return (
    <Section id="details">
      <SectionHeading
        eyebrow="The details"
        title="It's the small things that make it tick."
        lead='The thoughtful touches that turn "a place to type numbers" into something that actually tells the truth about your money.'
      />
      <Grid>
        {DETAILS.map((d) => (
          <Cell key={d.key}>
            <Key>{d.key}</Key>
            <Text>{d.text}</Text>
          </Cell>
        ))}
      </Grid>
    </Section>
  );
}
