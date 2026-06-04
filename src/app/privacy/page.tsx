export const metadata = { title: "Privacy — Halcyon" };

export default function PrivacyPage() {
  return (
    <main
      style={{ maxWidth: "60ch", margin: "0 auto", padding: "2rem 1.5rem" }}
    >
      <h1>Privacy Policy</h1>
      <p>
        <em>
          Placeholder — this policy has not yet been finalised. Replace this
          copy before relying on it. Not legal advice.
        </em>
      </p>

      <h2>What we collect</h2>
      <p>TODO: describe the personal and financial data Halcyon stores.</p>

      <h2>How we use it</h2>
      <p>TODO: describe purposes and lawful basis.</p>

      <h2>Your rights</h2>
      <p>
        You can export, clear, or permanently delete your data at any time from
        Settings → Your data. Account deletion is permanent and removes your
        login and all associated records.
      </p>

      <h2>Cookies</h2>
      <p>
        Halcyon sets a single strictly-necessary cookie — your Supabase
        authentication session (<code>HttpOnly</code>, <code>Secure</code>,
        <code>SameSite=Lax</code>) — which keeps you signed in. We use no
        analytics, tracking, or advertising cookies, and we do not share your
        data for marketing. Because the only cookie is essential to providing
        the service, no cookie-consent banner is required.
      </p>
    </main>
  );
}
