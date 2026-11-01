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
        Five parts, one monthly habit: bring in the month, read the budget,
        record your balances, and see the year and the years ahead.
      </Standfirst>
      <ArticleList
        articles={FEATURES}
        hrefFor={(article) => `/features/${article.slug}`}
      />
    </Page>
  );
}
