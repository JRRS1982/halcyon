"use client";

import styled, { css } from "styled-components";
import { MarketingShot } from "@/components/marketing/MarketingShot";
import type { Article } from "@/lib/editorial/features";
import {
  Caption,
  CtaRow,
  Figure,
  Headline,
  OutlineLink,
  Page,
  PrimaryLink,
  Rule,
  SectionHead,
  Standfirst,
} from "./Editorial.styled";

// One article: headline and standfirst across the page, then the body in a
// readable column with its pictures, the small print as ruled briefs, and the
// way in. The template a blog post would use too.

const Body = styled.div`
  max-width: 720px;
`;

const Section = styled.section`
  ${({ theme }) => css`
    margin-top: ${theme.spacing["3xl"]};
    padding-top: ${theme.spacing.md};
    border-top: 1px solid ${theme.colors.ink};
  `}
`;

const SectionTitle = styled.h2`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-weight: 700;
    font-size: 26px;
    line-height: 1.2;
    color: ${theme.colors.ink};
  `}
`;

const Paragraph = styled.p`
  ${({ theme }) => css`
    font-size: 17px;
    line-height: 1.65;
    color: ${theme.colors.ink};
    margin-top: ${theme.spacing.md};
  `}
`;

const Briefs = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: ${({ theme }) => theme.spacing["2xl"]};

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const Brief = styled.div`
  ${({ theme }) => css`
    padding: ${theme.spacing.md} 0 ${theme.spacing.lg};
    border-top: 1px solid ${theme.colors.ink};

    h3 {
      font-family: ${theme.typography.displayLg.family};
      font-weight: 700;
      font-size: 19px;
      line-height: 1.25;
    }
    p {
      font-size: 15px;
      line-height: 1.55;
      color: ${theme.colors.body};
      margin-top: ${theme.spacing.xs};
    }
  `}
`;

export function ArticleView({ article }: { article: Article }) {
  return (
    <Page>
      <Headline>{article.headline}</Headline>
      <Standfirst>{article.standfirst}</Standfirst>

      <Body>
        {article.sections.map((section) => (
          <Section key={section.heading}>
            <SectionTitle>{section.heading}</SectionTitle>
            {section.paragraphs.map((paragraph) => (
              <Paragraph key={paragraph}>{paragraph}</Paragraph>
            ))}
            {section.picture && (
              <Figure>
                <MarketingShot
                  src={section.picture.src}
                  alt={section.picture.alt}
                  label={section.heading}
                  aspect={section.picture.aspect}
                  phone={section.picture.phone}
                  dark={section.picture.dark}
                  sizes="(max-width: 760px) 100vw, 720px"
                />
                {section.picture.caption && (
                  <Caption>{section.picture.caption}</Caption>
                )}
              </Figure>
            )}
          </Section>
        ))}
      </Body>

      {article.smallPrint.length > 0 && (
        <>
          <Rule />
          <SectionHead>The small print</SectionHead>
          <Briefs>
            {article.smallPrint.map((brief) => (
              <Brief key={brief.key}>
                <h3>{brief.key}</h3>
                <p>{brief.text}</p>
              </Brief>
            ))}
          </Briefs>
        </>
      )}

      <Rule />
      <SectionHead>Put the spreadsheet down</SectionHead>
      <CtaRow>
        <PrimaryLink href="/sign-up">Get started</PrimaryLink>
        <OutlineLink href="/features">Features</OutlineLink>
      </CtaRow>
    </Page>
  );
}
