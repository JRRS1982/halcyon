"use client";

import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import styled from "styled-components";

const Shell = styled.main`
  max-width: 560px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing["3xl"]}
    ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};

  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
`;

const Body = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.body};
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.xl};
`;

const QuietLink = styled(Link)`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.accent};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

type Props = {
  token: string;
  done?: string;
  action: (formData: FormData) => Promise<void>;
};

export function UnsubscribePanel({ token, done, action }: Props) {
  // Already acted on. "Unsubscribed" and "already off" get the same reassuring
  // wording — someone clicking a link from an old email wants to hear that they
  // are off the list, not that their click did nothing.
  if (done === "unsubscribed" || done === "already-off") {
    return (
      <Shell>
        <PageHeader
          eyebrow="Reminders"
          title="You're unsubscribed"
          lead="No more monthly reminders. Your account and everything in it is untouched."
        />
        <Body>
          Changed your mind? You can turn them back on any time in Settings.
        </Body>
        <Actions>
          <QuietLink href="/settings">Go to Settings</QuietLink>
        </Actions>
      </Shell>
    );
  }

  // An unrecognised token. Not framed as an error the visitor caused: the
  // likeliest cause is that the account was deleted, which is a state they
  // already wanted.
  if (done === "unknown" || !token) {
    return (
      <Shell>
        <PageHeader
          eyebrow="Reminders"
          title="That link has expired"
          lead="We can't match it to an account — which usually means the account was already deleted, or the reminder was switched off from Settings."
        />
        <Body>
          Either way, no reminders are going to that address. If you're still
          getting them, sign in and switch them off in Settings.
        </Body>
        <Actions>
          <QuietLink href="/settings">Go to Settings</QuietLink>
        </Actions>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        eyebrow="Reminders"
        title="Stop monthly reminders?"
        lead="This turns off the once-a-month email. Nothing else changes — your account, your figures and your history all stay exactly as they are."
      />
      {/* A form, so the actual change is a POST. The link that brought you here
          was a GET, and mail clients and link scanners follow those on their
          own — acting on that would unsubscribe people who only received the
          message. */}
      <form action={action}>
        <input type="hidden" name="token" value={token} />
        <Actions>
          <Button type="submit">Unsubscribe</Button>
          <QuietLink href="/settings">Keep them, take me to Settings</QuietLink>
        </Actions>
      </form>
    </Shell>
  );
}
