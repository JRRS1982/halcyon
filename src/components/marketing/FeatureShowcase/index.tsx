import { MarketingShot } from "@/components/marketing/MarketingShot";
import {
  Body,
  Bullet,
  BulletKey,
  BulletList,
  Copy,
  Eyebrow,
  Row,
  Title,
} from "./FeatureShowcase.styled";

type BulletItem = { key: string; text: string };

type Shot = { src?: string; alt: string; label: string; caption?: string };

type FeatureShowcaseProps = {
  eyebrow: string;
  title: string;
  body: string;
  shot: Shot;
  imageSide: "left" | "right";
  bullets?: BulletItem[];
};

export function FeatureShowcase({
  eyebrow,
  title,
  body,
  shot,
  imageSide,
  bullets,
}: FeatureShowcaseProps) {
  const copy = (
    <Copy>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title>{title}</Title>
      <Body>{body}</Body>
      {bullets && bullets.length > 0 ? (
        <BulletList>
          {bullets.map((b) => (
            <Bullet key={b.key}>
              <BulletKey>{b.key}</BulletKey>
              {b.text}
            </Bullet>
          ))}
        </BulletList>
      ) : null}
    </Copy>
  );

  const image = <MarketingShot {...shot} />;

  return (
    <Row>
      {imageSide === "left" ? (
        <>
          {image}
          {copy}
        </>
      ) : (
        <>
          {copy}
          {image}
        </>
      )}
    </Row>
  );
}
