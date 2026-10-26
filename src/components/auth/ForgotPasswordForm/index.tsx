"use client";

import { requestPasswordReset } from "@/app/(app)/forgot-password/actions";
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
  Success,
} from "../AuthCard/AuthCard.styled";

type ForgotPasswordFormProps = {
  error?: string;
  isSent: boolean;
};

export function ForgotPasswordForm({ error, isSent }: ForgotPasswordFormProps) {
  return (
    <AuthCard
      eyebrow="Forgot password"
      title="Reset your password"
      lead="Enter the email you sign in with and we'll send you a link to choose a new password."
      footnote={
        <Footnote>
          Remembered it? <FootLink href="/sign-in">Sign in</FootLink>
        </Footnote>
      }
    >
      {error && <Alert role="alert">{error}</Alert>}

      {isSent && (
        <Success>
          If an account uses that address, a reset link is on its way. Check
          your inbox, and your spam folder.
        </Success>
      )}

      <Form action={requestPasswordReset}>
        <Field>
          <Label>Email</Label>
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Button type="submit" style={{ width: "100%" }}>
          Send reset link
        </Button>
      </Form>
    </AuthCard>
  );
}
