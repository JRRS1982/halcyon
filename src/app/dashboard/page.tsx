import { createClient } from "@/lib/supabase/server";

// Protected by src/lib/supabase/middleware.ts — unauthenticated visitors are
// redirected to /sign-in?next=/dashboard before this code runs. The getUser()
// call here is therefore defensive (TypeScript still wants a non-null narrow).
export default async function DashboardPage() {
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
      <h1>Dashboard</h1>
      <p>
        Signed in as <strong>{user?.email}</strong>
      </p>
      <p style={{ color: "#666" }}>
        This is a protected route. Anyone hitting <code>/dashboard</code>{" "}
        without a session is sent to <code>/sign-in?next=/dashboard</code> by
        the middleware.
      </p>
    </main>
  );
}
