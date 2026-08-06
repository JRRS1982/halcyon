import Image from "next/image";
import { Caption, Frame, Label, Placeholder } from "./MarketingShot.styled";

type MarketingShotProps = {
  /** Public path e.g. "/marketing/dashboard.png". Omit to show a placeholder. */
  src?: string;
  /** Alt text for the captured screenshot. */
  alt: string;
  /** Mono-caps label shown in the placeholder. */
  label: string;
  /** Optional supporting line in the placeholder. */
  caption?: string;
  /**
   * Set on the hero shot only. next/image lazy-loads by default, which for the
   * above-the-fold screenshot means the browser discovers the page's Largest
   * Contentful Paint element late and LCP suffers. `priority` preloads it and
   * drops the lazy attribute. Exactly one image per page should set this —
   * marking everything priority preloads everything and helps nothing.
   */
  priority?: boolean;
};

export function MarketingShot({
  src,
  alt,
  label,
  caption,
  priority = false,
}: MarketingShotProps) {
  return (
    <Frame>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 760px) 100vw, 50vw"
          style={{ objectFit: "cover" }}
        />
      ) : (
        <Placeholder>
          <Label>{label}</Label>
          {caption ? <Caption>{caption}</Caption> : null}
        </Placeholder>
      )}
    </Frame>
  );
}
