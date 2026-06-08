import { Band, Eyebrow, InvertedCta, Text, Title } from "./CtaBand.styled";

export function CtaBand() {
  return (
    <Band>
      <Eyebrow>Get started</Eyebrow>
      <Title>Put the spreadsheet down.</Title>
      <Text>
        Create a free account and let Balanced give your money the structure
        it&apos;s been missing — and guide you to what matters.
      </Text>
      <InvertedCta href="/sign-up">Get started</InvertedCta>
    </Band>
  );
}
