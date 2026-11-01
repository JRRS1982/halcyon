import Link from "next/link";
import {
  Caption,
  CtaRow,
  Figure,
  Headline,
  OutlineLink,
  PrimaryLink,
  Standfirst,
  Trust,
} from "@/components/editorial/Editorial.styled";
import { MarketingShot } from "@/components/marketing/MarketingShot";
import { Narrow, Section, Wide } from "./Hero.styled";

export function Hero() {
  return (
    <Section>
      <div>
        <Headline>Make sense of your money.</Headline>
        <Standfirst>
          Balanced Money is a monthly check-in for your household&apos;s money.
          Bring in your bank statement, see where it went, watch your savings
          and net worth grow, and plan for your future.
        </Standfirst>
        <CtaRow>
          <PrimaryLink href="/sign-up">Get started</PrimaryLink>
          <OutlineLink href="/sign-in">Sign in</OutlineLink>
        </CtaRow>
        <Trust>
          You choose what goes in: a statement you export yourself, or a line
          you type. Your data is yours to{" "}
          <Link href="/guide">export or delete</Link> at any time.
        </Trust>
      </div>
      <Figure>
        <Wide>
          <MarketingShot
            src="/marketing/plates/budget-lead.png"
            priority
            label="Budget"
            alt="The Balanced budget page for a sample October: the headline 'Spending came in £570 under plan, led by Holidays', the left-over figure, and notes on what ran over and what held"
            aspect="2424 / 1154"
            sizes="(max-width: 1023px) 100vw, 680px"
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
          A sample month. Balanced writes the headline and notes from your own
          figures.
        </Caption>
      </Figure>
    </Section>
  );
}
