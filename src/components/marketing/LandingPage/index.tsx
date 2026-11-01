"use client";

import { CtaBand } from "@/components/marketing/CtaBand";
import { DetailGrid } from "@/components/marketing/DetailGrid";
import { FeatureArticles } from "@/components/marketing/FeatureArticles";
import { Hero } from "@/components/marketing/Hero";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Container } from "./LandingPage.styled";

// Set as a financial paper: the front page (what Balanced is, a sample month,
// the monthly briefing), the inside pages (one article per feature), the small
// print, and the sign-up panel. Nothing else, so a visitor can take it all in
// within a minute.
export function LandingPage() {
  return (
    <>
      <main>
        <Container>
          <Hero />
          <FeatureArticles />
          <DetailGrid />
          <CtaBand />
        </Container>
      </main>
      <MarketingFooter />
    </>
  );
}
