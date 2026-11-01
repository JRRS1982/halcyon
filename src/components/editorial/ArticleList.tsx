import { MarketingShot } from "@/components/marketing/MarketingShot";
import type { Article } from "@/lib/editorial/features";
import {
  More,
  Stories,
  Story,
  StoryText,
  StoryTitle,
} from "./Editorial.styled";

/** Articles as a paper lists them: picture, headline, teaser, each a link. */
export function ArticleList({
  articles,
  hrefFor,
}: {
  articles: Article[];
  hrefFor: (article: Article) => string;
}) {
  return (
    <Stories>
      {articles.map((article) => (
        <Story key={article.slug} href={hrefFor(article)}>
          <MarketingShot
            src={article.picture.src}
            alt=""
            label={article.name}
            aspect={article.picture.aspect}
            sizes="(max-width: 860px) 100vw, 600px"
          />
          <StoryTitle>{article.headline}</StoryTitle>
          <StoryText>{article.teaser}</StoryText>
          <More>{article.name}</More>
        </Story>
      ))}
    </Stories>
  );
}
