"use client";

import type { ReactNode } from "react";
import { Card, Eyebrow, Lead, Page, Title } from "./AuthCard.styled";

type AuthCardProps = {
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
  footnote: ReactNode;
};

export function AuthCard({
  eyebrow,
  title,
  lead,
  children,
  footnote,
}: AuthCardProps) {
  return (
    <Page>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title>{title}</Title>
      <Lead>{lead}</Lead>
      <Card>{children}</Card>
      {footnote}
    </Page>
  );
}
