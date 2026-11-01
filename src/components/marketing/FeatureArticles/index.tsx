import { MarketingShot } from "@/components/marketing/MarketingShot";
import {
  Article,
  Body,
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
    src: "/marketing/transactions.png",
    alt: "The Balanced transactions ledger: rows to approve, each with its category in pencil until approved",
    title: "A bank statement in, a sorted month out",
    body: "Drop in a CSV and Balanced maps the columns, skips the rows you already have, and files each merchant the way you filed it before, in pencil until you approve it. Paid cash for a coffee? Write the line as you would jot it.",
  },
  {
    id: "budget",
    src: "/marketing/budget.png",
    alt: "The Balanced budget page: a computed headline over the budget, actual, vs budget and share of spend columns",
    title: "Where did the money go? The budget tells you",
    body: "Set a budget for each category and your spending fills in beside it. Each month opens with a headline written from your own figures: what ran over, what held, and which category took the biggest share.",
  },
  {
    id: "balance",
    src: "/marketing/balance.png",
    alt: "The Balanced balance sheet: net worth's move since last month, and each account's change",
    title: "Wealthy, or just spending?",
    body: "Your bank balance can mislead. A big pension contribution leaves you feeling broke while your net worth climbs. The balance sheet tracks what you own and owe, account by account, and shows how each moved since last month.",
  },
  {
    id: "plan",
    src: "/marketing/plan.png",
    alt: "The Balanced plan: a verdict on whether the money lasts, above a projection of net worth to age 95",
    title: "Will the money last?",
    body: "Give Balanced your date of birth and the accounts and budget you already keep become a forecast to age 95, with real UK tax bands. Retire a year later or expect a point less growth, and it tells you plainly whether it still works, as a range rather than a guess.",
  },
];

export function FeatureArticles() {
  return (
    <Section id="features" aria-labelledby="features-head">
      <SectionHead id="features-head">Inside: what Balanced does</SectionHead>
      <Grid>
        {ARTICLES.map((article) => (
          <Article key={article.id} id={article.id}>
            <MarketingShot
              src={article.src}
              alt={article.alt}
              label={article.title}
              aspect="16 / 9"
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
