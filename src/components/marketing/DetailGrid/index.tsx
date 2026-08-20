import { SectionHeading } from "@/components/marketing/SectionHeading";
import {
  Cell,
  Grid,
  GroupTitle,
  Inner,
  Key,
  Section,
  Text,
} from "./DetailGrid.styled";

// Five groups of three, which is exactly one row each at the grid's desktop
// width. Every claim here describes behaviour that exists — this section is
// the one most likely to drift into wishful thinking as the app grows.
const GROUPS: {
  title: string;
  items: { key: string; text: string }[];
}[] = [
  {
    title: "Getting the month in",
    items: [
      {
        key: "Columns guessed, not demanded",
        text: "Balanced reads your statement's header row and works out which column holds the date, the description and the amount — then shows you what it guessed, so nothing is written on an assumption you never saw.",
      },
      {
        key: "Duplicate-safe imports",
        text: "Re-import an overlapping statement and Balanced spots the rows you already have, so nothing gets counted twice.",
      },
      {
        key: "Reversible imports",
        text: "Imported the wrong file? Undo the entire import in one action — the ledger snaps back to exactly where it was.",
      },
    ],
  },
  {
    title: "Less work every month",
    items: [
      {
        key: "It learns your merchants",
        text: "File “TESCO STORES 3421” once and the next import files “TESCO STORES 2211” the same way — the till and reference digits are ignored, so a shop only has to be taught once.",
      },
      {
        key: "Carried-over values say so",
        text: "Copy last month's balances forward and they arrive dimmed, with a note. They stay dimmed until you confirm each one, so last month's figure can never quietly pose as today's.",
      },
      {
        key: "Whose date order? Yours",
        text: "03/04 is the 3rd of April to one bank and the 4th of March to another. Balanced asks which order your statement uses rather than guessing and booking half your month into the wrong day.",
      },
    ],
  },
  {
    title: "Numbers that tell the truth",
    items: [
      {
        key: "Transfers aren't spending",
        text: "Move money between your own accounts and Balanced treats it as a transfer, not spending — so your expenditure stays honest and you don't look poorer or richer than you are.",
      },
      {
        key: "Live & in sync",
        text: 'Edit or import a transaction and every chart, total and budget recalculates instantly — no refresh, no stale numbers, no "recalculate" button.',
      },
      {
        key: "Unbudgeted spending can't hide",
        text: "Spend in a category you never budgeted for and it still appears on the sheet, showing a £0 budget against real spending — the thing you didn't plan for is the thing you can't miss.",
      },
    ],
  },
  {
    title: "Reading the result",
    items: [
      {
        key: "Up isn't always good",
        text: "Every headline figure knows which way is progress: net worth climbing is green, spending against budget climbing is red. Nothing is congratulated merely for going up.",
      },
      {
        key: "It won't invent a comparison",
        text: "One month in, there is no “change since last month”, because there isn't one. And “0% of budget used” stays hidden when nothing was budgeted — it reads as restraint when it means the opposite.",
      },
      {
        key: "A range, not a single number",
        text: "Your plan projects three ways — returns better, worse and as expected — so the verdict reads “runs short at 82, between 78 and 91” rather than pretending anyone knows the year.",
      },
    ],
  },
  {
    title: "Yours, and only yours",
    items: [
      {
        key: "Notes & original detail",
        text: "Add a note to any transaction and keep the original statement details beside the tidy, categorised version.",
      },
      {
        key: "An email with no numbers in it",
        text: "The optional monthly nudge says your month is ready and nothing more — no balance, no total, no category. Your figures stay behind a login rather than sitting in an inbox.",
      },
      {
        key: "Your data, yours",
        text: "Export everything to a file, clear your data, or delete your account outright — no dark patterns, no hostage-taking.",
      },
    ],
  },
];

export function DetailGrid() {
  return (
    <Section id="details">
      <Inner>
        <SectionHeading
          eyebrow="The details"
          title="It's the small things that make it tick."
          lead='The thoughtful touches that turn "a place to type numbers" into something that actually tells the truth about your money.'
        />
        {GROUPS.map((group) => (
          <div key={group.title}>
            <GroupTitle>{group.title}</GroupTitle>
            <Grid>
              {group.items.map((d) => (
                <Cell key={d.key}>
                  <Key>{d.key}</Key>
                  <Text>{d.text}</Text>
                </Cell>
              ))}
            </Grid>
          </div>
        ))}
      </Inner>
    </Section>
  );
}
