"use client";

import { signUp } from "@/app/(app)/sign-up/actions";
import { signInWithGoogle } from "@/app/auth/oauth-actions";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "../AuthCard";
import {
  Alert,
  Divider,
  Field,
  FootLink,
  Footnote,
  Form,
  Input,
  Label,
  Success,
} from "../AuthCard/AuthCard.styled";

type SignUpFormProps = {
  error?: string;
  success?: string;
};

export function SignUpForm({ error, success }: SignUpFormProps) {
  return (
    <AuthCard
      eyebrow="Get started"
      title="Create your account"
      lead="A clear home for your money — in a couple of minutes."
      footnote={
        <Footnote>
          Already have an account? <FootLink href="/sign-in">Sign in</FootLink>
        </Footnote>
      }
    >
      {error && <Alert role="alert">{error}</Alert>}

      {success && (
        <Success>
          Check your email for a confirmation link to finish signing up.
        </Success>
      )}

      <Form action={signUp}>
        <Field>
          <Label>Email</Label>
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field>
          <Label>Password</Label>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <Button type="submit" style={{ width: "100%" }}>
          Create account
        </Button>
      </Form>

      <Divider>or</Divider>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" style={{ width: "100%" }}>
          Continue with Google
        </Button>
      </form>
    </AuthCard>
  );
}
