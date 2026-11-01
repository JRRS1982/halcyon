import { MarketingShot } from "@/components/marketing/MarketingShot";
import {
  Briefing,
  Caption,
  CtaRow,
  Dateline,
  Figure,
  Front,
  GuideLink,
  Headline,
  Lead,
  Markets,
  MarketsTable,
  Move,
  Narrow,
  Note,
  OutlineLink,
  Picture,
  PrimaryLink,
  Rail,
  RailHead,
  Section,
  Skybox,
  Standfirst,
  Steps,
  Teaser,
  TeaserText,
  Trust,
  TrustLink,
  Wide,
} from "./Hero.styled";

// The questions a visitor arrives with, each pointing at the article below
// that answers it.
const TEASERS = [
  {
    href: "#budget",
    title: "Where did the money go?",
    text: "Every month read back to you, category by category.",
  },
  {
    href: "#balance",
    title: "Am I actually getting richer?",
    text: "Net worth, account by account, month on month.",
  },
  {
    href: "#plan",
    title: "Will it last?",
    text: "Your figures projected to age 95, as a range.",
  },
];

// The sample month the lead picture shows, in figures. Labelled as a sample
// wherever it appears: it illustrates the product, not a user. `good` says
// whether the move helped, which sets its colour.
const SAMPLE_MONTH = [
  { label: "Left over", figure: "£1,520", move: "▲ £470 on plan", good: true },
  {
    label: "Spending",
    figure: "£2,480",
    move: "▼ £570 under plan",
    good: true,
  },
  {
    label: "Net worth",
    figure: "£348,326",
    move: "▲ £4,551 on September",
    good: true,
  },
];

export function Hero() {
  return (
    <Section>
      <Dateline>
        <span>The monthly edition · Personal finance</span>
        <span>Always working for you</span>
      </Dateline>
      <Skybox aria-label="In this edition">
        {TEASERS.map((teaser) => (
          <Teaser key={teaser.href} href={teaser.href}>
            <TeaserText>
              <strong>{teaser.title}</strong>
              {teaser.text}
            </TeaserText>
          </Teaser>
        ))}
      </Skybox>

      <Front>
        <Lead>
          <Headline>Make sense of your money.</Headline>
          <Standfirst>
            Balanced Money replaces the budgeting spreadsheet. Bring in a bank
            statement or type a line, and each month reads back like the money
            pages: what moved, why, and where it went.
          </Standfirst>
          <CtaRow>
            <PrimaryLink href="/sign-up">Get started</PrimaryLink>
            <OutlineLink href="/sign-in">Sign in</OutlineLink>
          </CtaRow>
          <Trust>
            You choose what goes in: a statement you export yourself, or a line
            you type. Your data is yours to{" "}
            <TrustLink href="/guide">export or delete</TrustLink> at any time.
          </Trust>
          <Picture>
            <Wide>
              <MarketingShot
                src="/marketing/plates/budget-lead.png"
                priority
                label="Budget"
                alt="The Balanced budget page for a sample October: the headline 'Spending came in £570 under plan, led by Holidays', the left-over figure, notes on what ran over and what held, and the first rows of the budget"
                aspect="2424 / 1154"
                sizes="(max-width: 1023px) 100vw, 800px"
              />
            </Wide>
            <Narrow>
              <MarketingShot
                src="/marketing/plates/budget-lead-phone.png"
                label="Budget"
                alt="The same budget page on a phone: the month's headline, the left-over figure and the notes"
                aspect="1170 / 1536"
                sizes="420px"
              />
            </Narrow>
            <Caption>
              A sample month. Balanced writes the headline and the notes from
              your own figures, never by hand and never invented.
            </Caption>
          </Picture>
        </Lead>

        <Rail>
          <RailHead>Your month, at a glance</RailHead>
          <Markets>
            <MarketsTable aria-label="A sample month's key figures">
              <tbody>
                {SAMPLE_MONTH.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>
                      <Figure>{row.figure}</Figure>
                      <Move $good={row.good}>{row.move}</Move>
                    </td>
                  </tr>
                ))}
              </tbody>
            </MarketsTable>
            <Note>
              A sample month, the one pictured. Yours come from your own
              statements and balances, coloured by whether the move helped.
            </Note>
          </Markets>

          <Briefing id="how">
            <RailHead>The monthly briefing</RailHead>
            <Steps>
              <li>
                <span>
                  <strong>Bring in the month</strong>
                  Import a statement, or write a line like “4.35 Pret coffee”.
                </span>
              </li>
              <li>
                <span>
                  <strong>Approve what was filed</strong>
                  Merchants you have filed before are filed again, in pencil
                  until you approve them.
                </span>
              </li>
              <li>
                <span>
                  <strong>Read the budget</strong>
                  See what ran over, what held, and where most of it went.
                </span>
              </li>
              <li>
                <span>
                  <strong>See where you stand</strong>
                  Update balances; net worth and the plan follow.
                </span>
              </li>
            </Steps>
            <GuideLink href="/guide">Read the full guide</GuideLink>
          </Briefing>
        </Rail>
      </Front>
    </Section>
  );
}
