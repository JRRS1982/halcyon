import { signInWithGoogle } from "../auth/oauth-actions";
import { signUp } from "./actions";

type Props = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function SignUpPage(props: Props) {
  const searchParams = await props.searchParams;
  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Create account</h1>

      {searchParams.error && (
        <p role="alert" style={{ color: "crimson" }}>
          {searchParams.error}
        </p>
      )}

      {searchParams.success && (
        <output style={{ color: "seagreen" }}>
          Check your email for a confirmation link to finish signing up.
        </output>
      )}

      <form action={signUp} style={{ display: "grid", gap: "0.75rem" }}>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          Password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <button type="submit">Create account</button>
      </form>

      <div style={{ margin: "1rem 0", textAlign: "center", color: "#888" }}>
        or
      </div>

      <form action={signInWithGoogle}>
        <button type="submit" style={{ width: "100%" }}>
          Continue with Google
        </button>
      </form>

      <p style={{ marginTop: "1rem" }}>
        Already have an account? <a href="/sign-in">Sign in</a>
      </p>
    </main>
  );
}
