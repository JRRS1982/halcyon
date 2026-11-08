import { getImageProps } from "next/image";
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
import { Section, Shot } from "./Hero.styled";

const alt =
  "The Balanced Money budget page for a sample October: the headline 'Spending came in £570 under plan, led by Holidays', the left-over figure, and notes on what ran over and what held";

// Desktop and phone each get the plate legible at the size it is shown, light
// or dark to match the page. One <picture> lets the browser fetch only the
// plate that matches, and fetch it first: it is the page's Largest Contentful
// Paint. The OS scheme alone decides here: this page has no session, so no
// stored preference can disagree with it.
const DARK = "(prefers-color-scheme: dark)";
const WIDE = "(min-width: 761px)";
const wideProps = (src: string) =>
  getImageProps({
    alt,
    fill: true,
    src,
    sizes: "(max-width: 1023px) 100vw, 680px",
  }).props;
const wide = wideProps("/marketing/plates/budget-lead.png");
const wideDark = wideProps("/marketing/plates/budget-lead-dark.png");
const {
  props: { srcSet: phoneDarkSrcSet },
} = getImageProps({
  alt,
  fill: true,
  src: "/marketing/plates/budget-lead-phone-dark.png",
  sizes: "420px",
});
const { props: phone } = getImageProps({
  alt,
  fill: true,
  src: "/marketing/plates/budget-lead-phone.png",
  sizes: "420px",
  loading: "eager",
  fetchPriority: "high",
  style: { objectFit: "cover", objectPosition: "top" },
});

export function Hero() {
  return (
    <Section>
      <div>
        <Headline>Make sense of your money.</Headline>
        <Standfirst>
          Bring in your bank statement and see where your money went, category
          by category. When you want more, set a budget, track your savings and
          plan ahead.
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
        <Shot>
          <picture>
            <source
              media={`${DARK} and ${WIDE}`}
              srcSet={wideDark.srcSet}
              sizes={wideDark.sizes}
            />
            <source media={WIDE} srcSet={wide.srcSet} sizes={wide.sizes} />
            <source media={DARK} srcSet={phoneDarkSrcSet} sizes="420px" />
            <img {...phone} alt={alt} />
          </picture>
        </Shot>
        <Caption>
          A sample month. Balanced Money writes the headline and notes from your
          own figures.
        </Caption>
      </Figure>
    </Section>
  );
}
