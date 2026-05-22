import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "4rem auto",
        padding: "0 1rem",
        display: "grid",
        gap: "1rem",
      }}
    >
      <h1>Welcome to Halcyon</h1>

      {user ? (
        <>
          <p>
            Signed in as <strong>{user.email}</strong>
          </p>
          <nav style={{ display: "flex", gap: "0.75rem" }}>
            <a href="/dashboard">Go to dashboard</a>
            <form action={signOut}>
              <button type="submit">Sign out</button>
            </form>
          </nav>
        </>
      ) : (
        <p>
          Not signed in. <a href="/sign-in">Sign in</a> or{" "}
          <a href="/sign-up">create an account</a>.
        </p>
      )}
    </main>
  );
}
