"use client";

import { ArticleList } from "@/components/editorial/ArticleList";
import {
  Headline,
  Page,
  Standfirst,
} from "@/components/editorial/Editorial.styled";
import { FEATURES } from "@/lib/editorial/features";

export function FeaturesIndex() {
  return (
    <Page>
      <Headline>Features</Headline>
      <Standfirst>
        One monthly habit: bring in the month, read the budget, record your
        balances, then see the year behind you and the years ahead. Each part
        has its own page below.
      </Standfirst>
      <ArticleList
        articles={FEATURES}
        hrefFor={(article) => `/features/${article.slug}`}
      />
    </Page>
  );
}
