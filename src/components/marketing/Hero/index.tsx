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
  TrustLink,
  TrustNote,
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
          <TrustNote>
            No bank connection, ever. Balanced never asks for your banking login
            — figures come from a CSV you export yourself. Your data is yours to{" "}
            <TrustLink href="/about">export or delete</TrustLink> at any time.
          </TrustNote>
        </div>
        <MarketingShot
          src="/marketing/dashboard.png"
          priority
          label="Dashboard"
          caption="Spending by category, cash flow, balance trend, net worth — at a glance"
          alt="The Balanced dashboard showing spending and net-worth charts"
        />
      </Grid>
    </Section>
  );
}
