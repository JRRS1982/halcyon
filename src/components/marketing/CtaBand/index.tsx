import {
  CtaRow,
  OutlineLink,
  PrimaryLink,
  Trust,
} from "@/components/marketing/Hero/Hero.styled";
import { Band, Text, Title } from "./CtaBand.styled";

export function CtaBand() {
  return (
    <Band aria-labelledby="cta-head">
      <Title id="cta-head">Put the spreadsheet down.</Title>
      <Text>
        Set up once with sensible defaults, then a few minutes each month: bring
        in the month, approve what was filed, and read where it went.
      </Text>
      <CtaRow>
        <PrimaryLink href="/sign-up">Get started</PrimaryLink>
        <OutlineLink href="/guide">Read the guide first</OutlineLink>
      </CtaRow>
      <Trust>
        No bank login, no adverts, no tracking. Export or delete everything from
        Settings, any time.
      </Trust>
    </Band>
  );
}
