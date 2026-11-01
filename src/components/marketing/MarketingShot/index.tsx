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
  /** The frame's shape, as a CSS aspect-ratio. A crop of the page, not a squash. */
  aspect?: string;
  /** Which part of the screenshot the crop keeps; the top by default. */
  position?: string;
  /** The rendered width, for next/image's source selection. */
  sizes?: string;
  /** Magnifies the crop around `position`, for a thumbnail of one detail. */
  zoom?: number;
};

export function MarketingShot({
  src,
  alt,
  label,
  caption,
  priority = false,
  aspect = "16 / 9",
  position = "top",
  sizes = "(max-width: 760px) 100vw, 50vw",
  zoom = 1,
}: MarketingShotProps) {
  return (
    <Frame style={{ aspectRatio: aspect }}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          style={{
            objectFit: "cover",
            objectPosition: position,
            transform: zoom === 1 ? undefined : `scale(${zoom})`,
            transformOrigin: position,
          }}
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
