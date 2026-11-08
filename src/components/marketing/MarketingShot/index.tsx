import Image, { getImageProps } from "next/image";
import {
  Caption,
  Frame,
  Label,
  Placeholder,
  Scheme,
} from "./MarketingShot.styled";

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
  /**
   * The same section as a phone renders it. Below 761px it replaces `src`,
   * shown whole in its own shape: a desktop plate shrunk to a phone's width
   * is too small to read.
   */
  phone?: { src: string; aspect: string };
  /** The same plates shot in the dark scheme, shown whenever the page is dark. */
  dark?: Variant;
};

type Variant = { src: string; phone?: string };

// Wide enough for the desktop plate, so a phone never downloads it.
const DESKTOP = "(min-width: 761px)";
const COVER_TOP = { objectFit: "cover", objectPosition: "top" } as const;

/** One scheme's plate: the desktop one, swapped for the phone one below 761px. */
function Plate({
  variant,
  alt,
  sizes,
}: {
  variant: Variant;
  alt: string;
  sizes: string;
}) {
  if (!variant.phone) {
    return (
      <Image src={variant.src} alt={alt} fill sizes={sizes} style={COVER_TOP} />
    );
  }
  const wide = getImageProps({ alt, fill: true, src: variant.src, sizes });
  const narrow = getImageProps({
    alt,
    fill: true,
    src: variant.phone,
    sizes: "100vw",
    style: COVER_TOP,
  });
  return (
    <picture>
      <source
        media={DESKTOP}
        srcSet={wide.props.srcSet}
        sizes={wide.props.sizes}
      />
      <img {...narrow.props} alt={alt} />
    </picture>
  );
}

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
  phone,
  dark,
}: MarketingShotProps) {
  if (src && (phone || dark)) {
    const light = { src, phone: phone?.src };
    return (
      <Frame $aspect={aspect} $phoneAspect={phone?.aspect}>
        {dark ? (
          <>
            <Scheme $scheme="light">
              <Plate variant={light} alt={alt} sizes={sizes} />
            </Scheme>
            <Scheme $scheme="dark">
              <Plate variant={dark} alt={alt} sizes={sizes} />
            </Scheme>
          </>
        ) : (
          <Plate variant={light} alt={alt} sizes={sizes} />
        )}
      </Frame>
    );
  }

  return (
    <Frame $aspect={aspect}>
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
