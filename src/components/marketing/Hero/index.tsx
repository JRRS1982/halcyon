import { MarketingShot } from "@/components/marketing/MarketingShot";
import {
  CtaRow,
  Eyebrow,
  Grid,
  Lead,
  OutlineLink,
  PrimaryLink,
  Section,
  Title,
} from "./Hero.styled";

export function Hero() {
  return (
    <Section>
      <Grid>
        <div>
          <Eyebrow>Personal finance, made clear</Eyebrow>
          <Title>Make sense of your money.</Title>
          <Lead>
            Balanced takes the place of the messy spreadsheet you&apos;ve been
            meaning to keep. It gives you the structure — and the gentle
            guidance — to track what you have, understand where it goes, and
            learn how you really spend.
          </Lead>
          <CtaRow>
            <PrimaryLink href="/sign-up">Get started</PrimaryLink>
            <OutlineLink href="/sign-in">Sign in</OutlineLink>
          </CtaRow>
        </div>
        <MarketingShot
          src="/marketing/dashboard.png"
          label="Dashboard"
          caption="Spending by category, cash flow, balance trend, net worth — at a glance"
          alt="The Balanced dashboard showing spending and net-worth charts"
        />
      </Grid>
    </Section>
  );
}
