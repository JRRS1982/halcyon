"use client";

import { ArticleList } from "@/components/editorial/ArticleList";
import {
  More,
  SectionHead,
  Stories,
  Story,
  StoryText,
  StoryTitle,
} from "@/components/editorial/Editorial.styled";
import { Hero } from "@/components/marketing/Hero";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingShot } from "@/components/marketing/MarketingShot";
import { type Article, featureBySlug } from "@/lib/editorial/features";
import { Container, Inside, Lead } from "./LandingPage.styled";

// The front page is articles and nothing else: the lead says what Balanced is
// and offers the way in; every story below links to its own page, where the
// detail lives. The stories run in the order a month does: the statement in,
// the budget it fills, the year it adds up to, what you own, and the plan last,
// as where the app grows once you are in.
export function LandingPage() {
  const dashboard = featureBySlug("dashboard");
  const settings = featureBySlug("settings");
  const story = (slugs: string[]) =>
    slugs.flatMap((slug) => featureBySlug(slug) ?? []);
  const href = (article: Article) => `/features/${article.slug}`;

  return (
    <>
      <main>
        <Container>
          <Hero />

          <Inside aria-labelledby="inside-head">
            <SectionHead id="inside-head">Inside</SectionHead>
            <ArticleList
              articles={story(["transactions", "budget"])}
              hrefFor={href}
            />
            {dashboard && (
              <Lead href="/features/dashboard">
                <div>
                  <StoryTitle>{dashboard.headline}</StoryTitle>
                  <StoryText>{dashboard.teaser}</StoryText>
                  <More>{dashboard.name}</More>
                </div>
                <MarketingShot
                  src={dashboard.picture.src}
                  alt=""
                  label={dashboard.name}
                  aspect={dashboard.picture.aspect}
                  phone={dashboard.picture.phone}
                  dark={dashboard.picture.dark}
                  sizes="(max-width: 860px) 100vw, 900px"
                />
              </Lead>
            )}
            <ArticleList articles={story(["balance", "plan"])} hrefFor={href} />
          </Inside>

          <Inside aria-labelledby="more-head">
            <SectionHead id="more-head">More</SectionHead>
            <Stories $columns={3} data-columns="3">
              <Story href="/sign-up">
                <StoryTitle>What you need to start</StoryTitle>
                <StoryText>
                  An email address and a bank statement downloaded as a CSV. You
                  never hand over a bank login or card details.
                </StoryText>
                <More>Start</More>
              </Story>
              <Story href="/guide">
                <StoryTitle>How a month works</StoryTitle>
                <StoryText>
                  Five steps, always in the same order, and about ten minutes a
                  month once you are set up.
                </StoryText>
                <More>Guide</More>
              </Story>
              {settings && (
                <Story href="/features/settings">
                  <StoryTitle>{settings.headline}</StoryTitle>
                  <StoryText>{settings.teaser}</StoryText>
                  <More>{settings.name}</More>
                </Story>
              )}
            </Stories>
          </Inside>
        </Container>
      </main>
      <MarketingFooter />
    </>
  );
}
