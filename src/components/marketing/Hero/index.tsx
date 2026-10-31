import { MarketingShot } from "@/components/marketing/MarketingShot";
import {
  Body,
  BoxTitle,
  Caption,
  Column,
  Columns,
  CtaRow,
  Dateline,
  Dek,
  Head,
  Kicker,
  Lead,
  Masthead,
  Never,
  NeverItem,
  OutlineLink,
  PrimaryLink,
  Section,
  SignUpBox,
  Steps,
  TrustLink,
} from "./Hero.styled";

export function Hero() {
  return (
    <Section>
      <Masthead>Make sense of your money.</Masthead>
      <Dateline>
        <span>Personal finance, read like the money pages</span>
        <span>The monthly edition</span>
        <span>No bank login · no ads · no AI</span>
      </Dateline>
      <Columns>
        <Column>
          <Kicker>The method</Kicker>
          <Lead>A few minutes a month, and the spreadsheet can go</Lead>
          <Dek>
            Most budgeting spreadsheets are quietly abandoned around month
            three. Balanced keeps the part that works and does the rest.
          </Dek>
          <Body>Each month runs the same four steps:</Body>
          <Steps>
            <li>Import a statement, or write a line</li>
            <li>Approve what Balanced filed for you</li>
            <li>Read the budget against your plan</li>
            <li>Update balances and see where you stand</li>
          </Steps>
          <Body>
            Then the plan carries it forward, decades ahead, with real UK tax
            bands.
          </Body>
          <CtaRow>
            <PrimaryLink href="/sign-up">Get started</PrimaryLink>
            <OutlineLink href="/sign-in">Sign in</OutlineLink>
          </CtaRow>
        </Column>
        <Column>
          <Kicker>What you&apos;ll read</Kicker>
          <Head>Every month comes back with a headline</Head>
          <MarketingShot
            src="/marketing/budget.png"
            priority
            label="Budget"
            caption="A month's budget, read back as a headline"
            alt="The Balanced budget page: a headline saying spending came in under plan, notes on what ran over and what held, and the budget table below"
          />
          <Caption>
            A sample month. Balanced writes the headline and notes from your own
            figures, never by hand and never invented.
          </Caption>
        </Column>
        <Column>
          <Kicker>What Balanced never does</Kicker>
          <Never>
            <NeverItem>
              <b>Ask for your bank login</b>
              No bank connection, ever. Figures come from a CSV you export
              yourself, or a line you type.
            </NeverItem>
            <NeverItem>
              <b>Sell or share your data</b>
              No analytics, no advertising, no tracking.
            </NeverItem>
            <NeverItem>
              <b>Keep you from leaving</b>
              Your data is yours to{" "}
              <TrustLink href="/guide">export or delete</TrustLink> at any time.
            </NeverItem>
          </Never>
          <SignUpBox>
            <BoxTitle>Start your own edition</BoxTitle>
            <Body>
              Set up once with sensible defaults, then a few minutes each month.
            </Body>
            <CtaRow>
              <OutlineLink href="/sign-up">Create your account</OutlineLink>
            </CtaRow>
          </SignUpBox>
        </Column>
      </Columns>
    </Section>
  );
}
