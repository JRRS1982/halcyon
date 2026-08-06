"use client";

import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { useEffect } from "react";
import styled, { css } from "styled-components";

// Route-level error boundary. Without it, a failed Prisma query or a thrown
// server action drops the user on Next's default error screen with no way back
// into the app. `reset()` re-renders the segment, which re-runs the server
// component — so a transient database blip really is fixed by "Try again".
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

// Escaping the error is navigation, not an action, so it's a link — right-click
// and "open in new tab" keep working, and it reads as a link to a screen reader.
// Matches button-outline (DESIGN.md → components).
const BackLink = styled(Link)`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    background: ${theme.colors.canvas};
    color: ${theme.colors.ink};
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    text-transform: uppercase;
    text-decoration: none;

    &:hover {
      border-color: ${theme.colors.ink};
    }

    @media (max-width: 767px) {
      min-height: 44px;
    }
  `}
`;

// The digest is the only handle on the server-side stack, which Next withholds
// from the browser in production. Showing it lets a user quote something
// useful instead of "it broke".
const Digest = styled.p`
  margin-top: ${({ theme }) => theme.spacing.xl};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.body};
`;

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <Shell>
      <PageHeader
        eyebrow="Something went wrong"
        title="We couldn't load this page."
        lead="The error has been logged. Trying again usually clears it — if it doesn't, head back to your dashboard."
      />
      <Actions>
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <BackLink href="/dashboard">Back to dashboard</BackLink>
      </Actions>
      {error.digest && <Digest>Reference: {error.digest}</Digest>}
    </Shell>
  );
}
