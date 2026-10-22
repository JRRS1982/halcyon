"use client";

import { useState, useTransition } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { CHANGE_PASSWORD_MESSAGES } from "@/lib/auth/changePasswordOutcome";
import { changePassword } from "./credentialActions";
import { SectionHeading, SettingsCard } from "./SectionHeading";

const Shell = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]};
  /* DESIGN.md → Layout → Grid & Container: gutters drop to 16px on mobile. */
  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
`;

const Lead = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  max-width: 60ch;
`;

const Fields = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  max-width: 320px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const FieldLabel = styled.label`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

const Input = styled.input`
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const Hint = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.body};
`;

const Alert = styled.p`
  margin: ${({ theme }) => theme.spacing.md} 0 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.negative};
`;

const Confirmation = styled(Alert)`
  color: ${({ theme }) => theme.colors.positive};
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
`;

export function ChangePassword() {
  const [pending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // null until a change lands; then whether the other devices actually went.
  const [othersSignedOut, setOthersSignedOut] = useState<boolean | null>(null);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setOthersSignedOut(null);

    startTransition(async () => {
      try {
        const result = await changePassword({ currentPassword, newPassword });
        if (!result.ok) {
          // The server named the reason, so the panel only has to read it.
          // Nothing here parses an error message: see changePasswordOutcome.
          setError(CHANGE_PASSWORD_MESSAGES[result.reason]);
          return;
        }
        setCurrentPassword("");
        setNewPassword("");
        setOthersSignedOut(result.othersSignedOut);
      } catch {
        // Reaching here means the action itself failed to run — a network
        // drop or a redeploy mid-request — not a rule the user broke.
        setError("Couldn't reach the server. Please try again.");
      }
    });
  };

  return (
    <Shell>
      <SettingsCard>
        <SectionHeading>Password</SectionHeading>
        <Lead>
          Changing your password signs out every other device. You&rsquo;ll stay
          signed in here.
        </Lead>

        <form onSubmit={onSubmit}>
          <Fields>
            <Field>
              <FieldLabel htmlFor="current-password">
                Current password
              </FieldLabel>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                // The browser answers the length rule before a round trip, the
                // way SignUpForm does. The schema in the action is the rule;
                // this is only the quicker way to hear about it.
                minLength={12}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                aria-describedby="new-password-hint"
              />
              <Hint id="new-password-hint">
                At least 12 characters, and not one that has appeared in a known
                data breach.
              </Hint>
            </Field>
          </Fields>

          <Actions>
            <Button
              type="submit"
              variant="primary"
              disabled={pending || !currentPassword || !newPassword}
            >
              {pending ? "Changing…" : "Change password"}
            </Button>
          </Actions>
        </form>

        {error ? <Alert role="alert">{error}</Alert> : null}
        {othersSignedOut === null ? null : (
          <Confirmation role="status">
            {othersSignedOut
              ? "Password changed. Any other devices have been signed out."
              : "Password changed — but we couldn't sign out your other devices. If you think someone else is signed in, sign out everywhere from your account and try again."}
          </Confirmation>
        )}
      </SettingsCard>
    </Shell>
  );
}
