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

// Desktop and phone each get the plate legible at the size it is shown. One
// <picture> lets the browser fetch only the plate that matches, and fetch it
// first: it is the page's Largest Contentful Paint.
const {
  props: { srcSet: wideSrcSet, sizes: wideSizes },
} = getImageProps({
  alt,
  fill: true,
  src: "/marketing/plates/budget-lead.png",
  sizes: "(max-width: 1023px) 100vw, 680px",
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
        <Shot>
          <picture>
            <source
              media="(min-width: 761px)"
              srcSet={wideSrcSet}
              sizes={wideSizes}
            />
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
