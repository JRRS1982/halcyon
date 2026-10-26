"use client";

import { resetPassword } from "@/app/(app)/reset-password/actions";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "../AuthCard";
import {
  Alert,
  Field,
  FootLink,
  Footnote,
  Form,
  Input,
  Label,
} from "../AuthCard/AuthCard.styled";

type ResetPasswordFormProps = {
  tokenHash?: string;
  error?: string;
};

export function ResetPasswordForm({
  tokenHash,
  error,
}: ResetPasswordFormProps) {
  return (
    <AuthCard
      eyebrow="Reset password"
      title="Choose a new password"
      lead="At least 12 characters. You'll be signed in once it's saved, and signed out everywhere else."
      footnote={
        <Footnote>
          Link not working?{" "}
          <FootLink href="/forgot-password">Request a new one</FootLink>
        </Footnote>
      }
    >
      {error && <Alert role="alert">{error}</Alert>}

      {tokenHash ? (
        <Form action={resetPassword}>
          <input type="hidden" name="tokenHash" value={tokenHash} />
          <Field>
            <Label>New password</Label>
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </Field>
          <Button type="submit" style={{ width: "100%" }}>
            Save new password
          </Button>
        </Form>
      ) : (
        <Alert role="alert">
          This page needs the link from your reset email. Open the link again,
          or request a new one.
        </Alert>
      )}
    </AuthCard>
  );
}
