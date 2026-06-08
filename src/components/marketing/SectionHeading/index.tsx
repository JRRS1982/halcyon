import { Eyebrow, Lead, Title, Wrap } from "./SectionHeading.styled";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  lead?: string;
};

export function SectionHeading({ eyebrow, title, lead }: SectionHeadingProps) {
  return (
    <Wrap>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title>{title}</Title>
      {lead ? <Lead>{lead}</Lead> : null}
    </Wrap>
  );
}
