import {
  Brief,
  Grid,
  Key,
  More,
  Section,
  SectionHead,
  Text,
} from "./DetailGrid.styled";

// Six details that answer the questions a careful person asks before handing
// over their numbers. The full list lives in the guide.
const BRIEFS = [
  {
    key: "It learns your merchants",
    text: "File “TESCO STORES 3421” once and the next import files “TESCO STORES 2211” the same way. A shop only has to be taught once.",
  },
  {
    key: "Imports you can take back",
    text: "Re-import an overlapping statement and the rows you already have are skipped. Imported the wrong file? Undo the whole import in one action.",
  },
  {
    key: "Transfers aren't spending",
    text: "Money moved between your own accounts is a transfer, so your spending stays honest and you never look poorer or richer than you are.",
  },
  {
    key: "Unbudgeted spending can't hide",
    text: "Spend in a category you never budgeted for and it still appears, against a £0 budget. The thing you didn't plan for is the thing you can't miss.",
  },
  {
    key: "It won't invent a comparison",
    text: "One month in, there is no “change since last month”, because there isn't one. Every sentence on the page comes from your own figures.",
  },
  {
    key: "A range, not a single number",
    text: "The plan projects three ways, so its verdict reads “runs short at 82, between 78 and 91” rather than pretending anyone knows the year.",
  },
];

export function DetailGrid() {
  return (
    <Section id="details" aria-labelledby="details-head">
      <SectionHead id="details-head">
        The small print, in plain English
      </SectionHead>
      <Grid>
        {BRIEFS.map((brief) => (
          <Brief key={brief.key}>
            <Key>{brief.key}</Key>
            <Text>{brief.text}</Text>
          </Brief>
        ))}
      </Grid>
      <More href="/guide">Every detail is in the guide</More>
    </Section>
  );
}
