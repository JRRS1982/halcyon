"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import styled, { css } from "styled-components";
import { PageHeader } from "@/components/ui/PageHeader";

// Shared shell for the long-form pages (/privacy, /cookies, /terms, and
// /how-its-built, which borrows the primitives below without the "Effective
// <date>" eyebrow that LegalPage hard-codes).
// Mirrors the guide's measure-as-container approach: 680px is a comfortable
// line length for bodyMd, so paragraphs fill the column instead of stopping
// short of rules and tables.
export const LegalShell = styled.main`
  max-width: 680px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};

  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
`;

export const LegalSection = styled.section`
  margin-top: ${({ theme }) => theme.spacing["2xl"]};
`;

export const LegalHeading = styled.h2`
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  font-family: ${({ theme }) => theme.typography.displayLg.family};
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  letter-spacing: ${({ theme }) => theme.typography.displayLg.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
`;

export const LegalBody = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  line-height: 1.65;
  color: ${({ theme }) => theme.colors.body};

  &:last-child {
    margin-bottom: 0;
  }

  strong {
    font-weight: ${({ theme }) => theme.typography.bodyMdStrong.weight};
    color: ${({ theme }) => theme.colors.ink};
  }

  code {
    font-family: ${({ theme }) => theme.typography.monoCaps.family};
    font-size: 0.85em;
  }
`;

export const LegalList = styled.ul`
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  padding-left: ${({ theme }) => theme.spacing.xl};

  li {
    font-family: ${({ theme }) => theme.typography.bodyMd.family};
    font-size: ${({ theme }) => theme.typography.bodyMd.size};
    line-height: 1.65;
    color: ${({ theme }) => theme.colors.body};
    margin-bottom: ${({ theme }) => theme.spacing.sm};

    &::marker {
      color: ${({ theme }) => theme.colors.dim};
    }

    strong {
      font-weight: ${({ theme }) => theme.typography.bodyMdStrong.weight};
      color: ${({ theme }) => theme.colors.ink};
    }
  }
`;

// Tables (processors, cookies) scroll inside their own frame on a phone so
// the page never scrolls sideways — the cookie table is the widest thing on
// any legal page.
export const LegalTableWrap = styled.div`
  overflow-x: auto;
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  margin: ${({ theme }) => theme.spacing.md} 0
    ${({ theme }) => theme.spacing.lg};
`;

export const LegalTable = styled.table`
  ${({ theme }) => css`
    width: 100%;
    border-collapse: collapse;
    font-family: ${theme.typography.bodyMd.family};
    font-size: 13px;
    line-height: 1.55;
    color: ${theme.colors.body};

    th {
      font-family: ${theme.typography.monoCaps.family};
      font-size: ${theme.typography.monoCaps.size};
      font-weight: ${theme.typography.monoCaps.weight};
      letter-spacing: ${theme.typography.monoCaps.letterSpacing};
      text-transform: uppercase;
      text-align: left;
      color: ${theme.colors.dim};
      padding: ${theme.spacing.sm} ${theme.spacing.md};
      border-bottom: 1px solid ${theme.colors.hairline};
      white-space: nowrap;
    }

    td {
      padding: ${theme.spacing.sm} ${theme.spacing.md};
      border-bottom: 1px solid ${theme.colors.hairline};
      vertical-align: top;
      min-width: 16ch;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    code {
      font-family: ${theme.typography.monoCaps.family};
      font-size: 0.85em;
      white-space: nowrap;
    }
  `}
`;

const linkStyles = css`
  color: ${({ theme }) => theme.colors.accent};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

export const LegalLink = styled(Link)`
  ${linkStyles}
`;

// mailto: and external hrefs — next/link buys nothing there.
export const LegalAnchor = styled.a`
  ${linkStyles}
`;

type LegalPageProps = {
  title: string;
  effectiveDate: string;
  children: ReactNode;
};

export function LegalPage({ title, effectiveDate, children }: LegalPageProps) {
  return (
    <LegalShell>
      <PageHeader eyebrow={`Effective ${effectiveDate}`} title={title} />
      {children}
    </LegalShell>
  );
}
