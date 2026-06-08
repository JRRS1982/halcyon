"use client";

import { CtaBand } from "@/components/marketing/CtaBand";
import { DetailGrid } from "@/components/marketing/DetailGrid";
import { FeatureShowcase } from "@/components/marketing/FeatureShowcase";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { Container, FeaturesIntro } from "./LandingPage.styled";

export function LandingPage() {
  return (
    <main>
      <Container>
        <Hero />
        <HowItWorks />

        <FeaturesIntro id="features">
          <SectionHeading
            eyebrow="Features"
            title="Structure where you'd otherwise wing it."
            lead="No more rolling your own tabs and formulas. Balanced gives every part of your money a proper home — and guides you to what actually matters."
          />
        </FeaturesIntro>

        <FeatureShowcase
          imageSide="left"
          eyebrow="Budget"
          title="Budget — then learn how you really spend."
          body="Set a budget for each category, then watch your categorised spending fill in beside it. The gap between the plan and the reality is the lesson: Balanced makes it impossible to ignore where your money is actually going."
          shot={{
            label: "Budget",
            alt: "The Balanced budget sheet showing budgeted vs actual by category",
            caption: "Budgeted vs. actual by category, once spending is sorted",
          }}
        />
        <FeatureShowcase
          imageSide="right"
          eyebrow="Balance"
          title="Wealthy, or just spending?"
          body="Your bank balance lies. Big pension contributions can leave you feeling broke while your net worth quietly climbs; a month of treats can feel rich while your assets go nowhere. Balanced sorts what you own and owe across short, medium and long-term horizons — so you can see whether you're truly getting ahead, and think past this month."
          shot={{
            label: "Balance",
            alt: "The Balanced balance sheet showing assets and liabilities by term",
            caption:
              "Assets & liabilities by short / medium / long term → net worth",
          }}
        />
        <FeatureShowcase
          imageSide="left"
          eyebrow="Transactions"
          title="Turn a bank statement into understanding."
          body="This is where Balanced earns its keep. Switch transactions on, drop in a statement, and a wall of cryptic bank rows becomes a clear, categorised picture of your month — and from there, every chart, budget and balance fills itself in."
          bullets={[
            {
              key: "Import",
              text: "Drop in a CSV statement and Balanced maps the columns for you.",
            },
            {
              key: "Auto-sort",
              text: "Each transaction lands in the right category, ready to review.",
            },
            {
              key: "Bulk edits",
              text: "Re-categorise or clear dozens of rows in one go — no row-by-row slog.",
            },
            {
              key: "Safe by default",
              text: "Duplicate-aware on import, and any import can be reversed in one click.",
            },
          ]}
          shot={{
            label: "Transactions",
            alt: "The Balanced transactions ledger with an imported statement sorted into categories",
            caption:
              "An imported statement, sorted into categories in the ledger",
          }}
        />
      </Container>

      <DetailGrid />
      <CtaBand />
      <MarketingFooter />
    </main>
  );
}
