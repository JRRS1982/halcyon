import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "4rem auto",
        padding: "0 1rem",
        display: "grid",
        gap: "1rem",
      }}
    >
      <h1>Welcome to Halcyon</h1>

      {user ? (
        <p>
          Signed in as <strong>{user.email}</strong>. Head to{" "}
          <a href="/budget">your budget</a> or the{" "}
          <a href="/dashboard">dashboard</a>.
        </p>
      ) : (
        <p>
          Not signed in. Use the Sign in button above or{" "}
          <a href="/sign-up">create an account</a>.
        </p>
      )}
    </main>
  );
}
