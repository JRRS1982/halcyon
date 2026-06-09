"use client";

import { signInWithGoogle } from "@/app/auth/oauth-actions";
import { signIn } from "@/app/sign-in/actions";
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
} from "../AuthCard/AuthCard.styled";

type SignInFormProps = {
  next: string;
  error?: string;
};

export function SignInForm({ next, error }: SignInFormProps) {
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

      <Divider>or</Divider>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" style={{ width: "100%" }}>
          Continue with Google
        </Button>
      </form>
    </AuthCard>
  );
}
