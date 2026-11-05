import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/editorial/ArticleView";
import { FEATURES, featureBySlug } from "@/lib/editorial/features";

// One page per feature, public like the guide: the front page's articles
// link here, so a prospect can read about a feature before signing up.
export function generateStaticParams() {
  return FEATURES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const article = featureBySlug((await params).slug);
  if (!article) return {};
  return {
    title: `${article.name} — Balanced Money`,
    description: article.standfirst,
  };
}

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const article = featureBySlug((await params).slug);
  if (!article) notFound();
  return <ArticleView article={article} />;
}
