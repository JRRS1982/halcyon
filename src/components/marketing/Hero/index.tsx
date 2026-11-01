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
} from "./Hero.styled";

// The questions a visitor arrives with, each pointing at the article below
// that answers it.
const TEASERS = [
  {
    href: "#budget",
    src: "/marketing/budget.png",
    // The month's headline and its left-over figure.
    position: "12% 20%",
    title: "Where did the money go?",
    text: "Every month read back to you, category by category.",
  },
  {
    href: "#balance",
    src: "/marketing/balance.png",
    // "Net worth rose …" and the brief beneath it.
    position: "12% 20%",
    title: "Am I actually getting richer?",
    text: "Net worth, account by account, month on month.",
  },
  {
    href: "#plan",
    src: "/marketing/plan.png",
    // The verdict and its figures.
    position: "15% 22%",
    title: "Will it last?",
    text: "Your figures projected to age 95, as a range.",
  },
];

// A sample month's figures, the same ones the lead picture shows. Labelled as
// a sample wherever they appear: they illustrate the product, not a user.
const SAMPLE_MONTH = [
  { label: "Left over", figure: "£1,455", move: "▲ £405 on plan" },
  { label: "Spending", figure: "£2,545", move: "▼ £505 under plan" },
  { label: "Net worth", figure: "£348,326", move: "▲ £4,551 on Sep" },
  { label: "Savings rate", figure: "36%", move: "▲ 1 pt on Sep" },
];

export function Hero() {
  return (
    <Section>
      <Skybox aria-label="In this edition">
        {TEASERS.map((teaser) => (
          <Teaser key={teaser.href} href={teaser.href}>
            <MarketingShot
              src={teaser.src}
              alt=""
              label={teaser.title}
              aspect="16 / 10"
              position={teaser.position}
              zoom={3}
              sizes="360px"
            />
            <TeaserText>
              <strong>{teaser.title}</strong>
              {teaser.text}
            </TeaserText>
          </Teaser>
        ))}
      </Skybox>

      <Dateline>
        <span>Personal finance, read like the money pages</span>
        <span>No bank login · No ads · No AI</span>
      </Dateline>

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
            No bank connection, ever. Figures come from a CSV you export
            yourself, or a line you type. Your data is yours to{" "}
            <TrustLink href="/guide">export or delete</TrustLink> at any time.
          </Trust>
          <Picture>
            <MarketingShot
              src="/marketing/budget.png"
              priority
              label="Budget"
              alt="The Balanced budget page: a headline saying spending came in £505 under plan, notes on what ran over and what held, and the budget table"
              aspect="16 / 8.5"
              // Below the app's own masthead: the month's headline leads.
              position="50% 70%"
              sizes="(max-width: 1023px) 100vw, 800px"
            />
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
                      <Move>{row.move}</Move>
                    </td>
                  </tr>
                ))}
              </tbody>
            </MarketsTable>
            <Note>
              Sample figures. Yours come from your own statements and balances,
              and say which way is good.
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
