import type { ReactNode } from "react";
import {
  Actions,
  Eyebrow,
  HeaderLeft,
  HeaderRow,
  Lead,
  Title,
} from "./PageHeader.styled";

export type PageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
}: PageHeaderProps) {
  return (
    <HeaderRow>
      <HeaderLeft>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <Title>{title}</Title>
        {lead && <Lead>{lead}</Lead>}
      </HeaderLeft>
      {actions && <Actions>{actions}</Actions>}
    </HeaderRow>
  );
}
