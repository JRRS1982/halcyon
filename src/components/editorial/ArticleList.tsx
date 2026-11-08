import { MarketingShot } from "@/components/marketing/MarketingShot";
import type { Article } from "@/lib/editorial/features";
import {
  More,
  Stories,
  Story,
  StoryText,
  StoryTitle,
} from "./Editorial.styled";

// One frame for every story, so pictures side by side share a height and the
// headlines beneath them line up. Wide enough that the widest plate (the plan
// chart) keeps its axes; taller plates lose rows from the bottom.
const STORY_ASPECT = "2 / 1";

/** Articles as a paper lists them: picture, headline, teaser, each a link. */
export function ArticleList({
  articles,
  hrefFor,
  titleLevel = "h3",
}: {
  articles: Article[];
  hrefFor: (article: Article) => string;
  titleLevel?: "h2" | "h3";
}) {
  return (
    <Stories>
      {articles.map((article) => (
        <Story key={article.slug} href={hrefFor(article)}>
          <MarketingShot
            src={article.picture.src}
            alt=""
            label={article.name}
            aspect={STORY_ASPECT}
            phone={article.picture.phone}
            dark={article.picture.dark}
            sizes="(max-width: 860px) 100vw, 600px"
          />
          <StoryTitle as={titleLevel}>{article.headline}</StoryTitle>
          <StoryText>{article.teaser}</StoryText>
          <More>{article.name}</More>
        </Story>
      ))}
    </Stories>
  );
}
