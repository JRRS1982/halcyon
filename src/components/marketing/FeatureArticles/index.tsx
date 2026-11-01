import { MarketingShot } from "@/components/marketing/MarketingShot";
import {
  Article,
  Body,
  Chart,
  ChartText,
  Grid,
  Section,
  SectionHead,
  Title,
} from "./FeatureArticles.styled";

// One article per feature, in the order a month is lived: money comes in,
// gets read, adds up, and is carried forward. The ids are where the front
// page's teasers point.
const ARTICLES = [
  {
    id: "transactions",
    src: "/marketing/plates/transactions.png",
    aspect: "2424 / 1398",
    alt: "The transactions page: '8 transactions to approve', the write-a-line box, and ledger rows whose suggested categories sit in pencil beside an Approve button",
    title: "A bank statement in, a sorted month out",
    body: "Drop in a CSV and Balanced maps the columns, skips the rows you already have, and files each merchant the way you filed it before, in pencil until you approve it. Paid cash for a coffee? Write the line as you would jot it.",
  },
  {
    id: "budget",
    src: "/marketing/plates/budget-share.png",
    aspect: "2464 / 1050",
    alt: "The budget's expenses: Fixed and Variable rows with how far each landed from budget and its share of the month's spending as a bar",
    title: "Where did the money go? The budget tells you",
    body: "Set a budget for each category and your spending fills in beside it. Each month opens with a headline written from your own figures: what ran over, what held, and which category took the biggest share.",
  },
  {
    id: "balance",
    src: "/marketing/plates/balance.png",
    aspect: "2424 / 1320",
    alt: "The balance sheet: 'Net worth rose £4,551 to £348,326', the biggest gain and drop, and each account's move since September",
    title: "Wealthy, or just spending?",
    body: "Your bank balance can mislead. A big pension contribution leaves you feeling broke while your net worth climbs. The balance sheet tracks what you own and owe, account by account, and shows how each moved since last month.",
  },
  {
    id: "plan",
    src: "/marketing/plates/plan.png",
    aspect: "2424 / 522",
    alt: "The plan's verdict: 'Your money runs short at age 90 (between 80 and 90 depending on returns)', with the figures at retirement and at 90",
    title: "Will the money last?",
    body: "Give Balanced your date of birth and the accounts and budget you already keep become a forecast to age 95, with real UK tax bands. Retire a year later or expect a point less growth, and it tells you plainly whether it still works, as a range rather than a guess.",
  },
];

export function FeatureArticles() {
  return (
    <Section id="features" aria-labelledby="features-head">
      <SectionHead id="features-head">Inside: what Balanced does</SectionHead>
      {/* The paper's chart of the day: a year of money in and out, the
          dashboard's own chart, set across the page above the articles. */}
      <Chart id="cashflow">
        <ChartText>
          <Title>Money in, money out, month by month</Title>
          <Body>
            The dashboard draws every month you have kept: what came in, what
            went out, the gap between them, and the share of your income you
            kept. A bad month shows up as a bad month, and the year shows
            whether it was a blip.
          </Body>
        </ChartText>
        <MarketingShot
          src="/marketing/plates/cashflow.png"
          alt="The dashboard's cash-flow chart for a sample year: green income and red expense bars for each month from December to October, a net line, and the share of income kept, with August dipping to £754 short"
          label="Cash flow"
          aspect="2464 / 648"
          sizes="(max-width: 860px) 100vw, 1200px"
        />
      </Chart>
      <Grid>
        {ARTICLES.map((article) => (
          <Article key={article.id} id={article.id}>
            <MarketingShot
              src={article.src}
              alt={article.alt}
              label={article.title}
              aspect={article.aspect}
              sizes="(max-width: 860px) 100vw, 600px"
            />
            <Title>{article.title}</Title>
            <Body>{article.body}</Body>
          </Article>
        ))}
      </Grid>
    </Section>
  );
}
