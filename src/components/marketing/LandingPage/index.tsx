"use client";

import { ArticleList } from "@/components/editorial/ArticleList";
import {
  More,
  SectionHead,
  Story,
  StoryText,
  StoryTitle,
} from "@/components/editorial/Editorial.styled";
import { Hero } from "@/components/marketing/Hero";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingShot } from "@/components/marketing/MarketingShot";
import { FEATURES, featureBySlug } from "@/lib/editorial/features";
import { Container, Inside, Lead, MoreStories } from "./LandingPage.styled";

// The front page is articles and nothing else: the lead says what Balanced is
// and offers the way in; every story below links to its own page, where the
// detail lives.
export function LandingPage() {
  const dashboard = featureBySlug("dashboard");
  const settings = featureBySlug("settings");
  // The four that answer a visitor's money questions; the dashboard leads
  // above them and settings closes the page with the guide.
  const others = FEATURES.filter(
    (article) => article.slug !== "dashboard" && article.slug !== "settings",
  );

  return (
    <>
      <main>
        <Container>
          <Hero />

          <Inside aria-labelledby="inside-head">
            <SectionHead id="inside-head">Inside</SectionHead>
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
                  sizes="(max-width: 860px) 100vw, 900px"
                />
              </Lead>
            )}
            <ArticleList
              articles={others}
              hrefFor={(article) => `/features/${article.slug}`}
            />
          </Inside>

          <Inside aria-labelledby="more-head">
            <SectionHead id="more-head">More</SectionHead>
            <MoreStories $columns={3} data-columns="3">
              {settings && (
                <Story href="/features/settings">
                  <StoryTitle>{settings.headline}</StoryTitle>
                  <StoryText>{settings.teaser}</StoryText>
                  <More>{settings.name}</More>
                </Story>
              )}
              <Story href="/guide">
                <StoryTitle>How a month works</StoryTitle>
                <StoryText>
                  Five steps, always in the same order, and about ten minutes a
                  month once you are set up.
                </StoryText>
                <More>Guide</More>
              </Story>
              <Story href="/how-its-built">
                <StoryTitle>Built to be used and trusted</StoryTitle>
                <StoryText>
                  What is in the app, why each piece is there, and how your data
                  is kept yours.
                </StoryText>
                <More>Engineering</More>
              </Story>
            </MoreStories>
          </Inside>
        </Container>
      </main>
      <MarketingFooter />
    </>
  );
}
