"use client";

import { signIn, signInAsDemo } from "@/app/(app)/sign-in/actions";
import { signInWithGoogle } from "@/app/auth/oauth-actions";
import { Button } from "@/components/ui/Button";
import { demoLoginEnabled } from "@/lib/auth/demo";
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
  Notice,
} from "../AuthCard/AuthCard.styled";

type SignInFormProps = {
  next: string;
  error?: string;
  notice?: string;
};

export function SignInForm({ next, error, notice }: SignInFormProps) {
  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Sign in"
      lead="Pick up where you left off."
      footnote={
        <Footnote>
          New here? <FootLink href="/sign-up">Create an account</FootLink>
        </Footnote>
      }
    >
      {error && <Alert role="alert">{error}</Alert>}
      {notice && <Notice>{notice}</Notice>}

      <Form action={signIn}>
        <input type="hidden" name="next" value={next} />
        <Field>
          <Label>Email</Label>
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field>
          <Label>Password</Label>
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Button type="submit" style={{ width: "100%" }}>
          Sign in
        </Button>
      </Form>

      {demoLoginEnabled && (
        <form action={signInAsDemo}>
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="outline" style={{ width: "100%" }}>
            Log in as demo (dev)
          </Button>
        </form>
      )}

      <Divider>or</Divider>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" style={{ width: "100%" }}>
          Continue with Google
        </Button>
      </form>
    </AuthCard>
  );
}
