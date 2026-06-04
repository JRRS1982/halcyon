import { signInWithGoogle } from "../auth/oauth-actions";
import { signIn } from "./actions";

type Props = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function SignInPage(props: Props) {
  const searchParams = await props.searchParams;
  const next = searchParams.next ?? "/";

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Sign in</h1>

      {searchParams.error && (
        <p role="alert" style={{ color: "crimson" }}>
          {searchParams.error}
        </p>
      )}

      <form action={signIn} style={{ display: "grid", gap: "0.75rem" }}>
        <input type="hidden" name="next" value={next} />
        <label style={{ display: "grid", gap: "0.25rem" }}>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit">Sign in</button>
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
        New here? <a href="/sign-up">Create an account</a>
      </p>
    </main>
  );
}
