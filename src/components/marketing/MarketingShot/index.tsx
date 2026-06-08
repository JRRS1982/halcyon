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
};

export function MarketingShot({ src, alt, label, caption }: MarketingShotProps) {
  return (
    <Frame>
      {src ? (
        <Image src={src} alt={alt} fill sizes="(max-width: 760px) 100vw, 50vw" style={{ objectFit: "cover" }} />
      ) : (
        <Placeholder>
          <Label>{label}</Label>
          {caption ? <Caption>{caption}</Caption> : null}
        </Placeholder>
      )}
    </Frame>
  );
}
