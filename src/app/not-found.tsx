"use client";

import Link from "next/link";
import styled, { css } from "styled-components";
import { PageHeader } from "@/components/ui/PageHeader";

const Shell = styled.main`
  max-width: 720px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};

  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.xl};
`;

const PillLink = styled(Link)`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    background: ${theme.colors.primary};
    color: ${theme.colors.onPrimary};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    text-transform: uppercase;
    text-decoration: none;

    &:hover {
      opacity: 0.85;
    }

    @media (max-width: 767px) {
      min-height: 44px;
    }
  `}
`;

export default function NotFound() {
  return (
    <Shell>
      <PageHeader
        eyebrow="404"
        title="That page doesn't exist."
        lead="The link may be out of date, or the page may have moved."
      />
      <Actions>
        <PillLink href="/dashboard">Go to dashboard</PillLink>
      </Actions>
    </Shell>
  );
}
