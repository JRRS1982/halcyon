export const metadata = { title: "Privacy Policy — Balanced Money" };

export default function PrivacyPage() {
  return (
    <main
      style={{ maxWidth: "60ch", margin: "0 auto", padding: "2rem 1.5rem" }}
    >
      <h1>Privacy Policy</h1>
      <p>
        <em>Effective date: 24 July 2026</em>
      </p>
      <p>
        This notice explains what personal data Balanced Money (&ldquo;the
        Service&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects when you
        use it, why, and the rights you have over that data. It should be read
        alongside the <a href="/terms">Terms of Service</a>.
      </p>

      <h2>What we collect</h2>
      <p>
        <strong>Account data.</strong> Your email address and sign-in
        credentials. Authentication is handled by Supabase Auth: passwords are
        stored only as secure hashes, and if you sign in with Google we receive
        your email address and basic profile details from Google.
      </p>
      <p>
        <strong>Financial data you enter.</strong> The budgets, balances,
        transactions, categories, accounts, and imported files you add to the
        Service. This data is private to your account and is stored only so the
        Service can show it back to you.
      </p>
      <p>
        <strong>Technical data.</strong> Our hosting providers keep standard
        server logs (such as IP address and browser type) for security and
        operations. We use no analytics, tracking, or advertising tools.
      </p>

      <h2>How we use it</h2>
      <p>
        We process your data to provide the Service you signed up for
        (performance of a contract) and to keep it secure and working
        (legitimate interests). We do not use your data for marketing or
        advertising, we do not sell it, and we do not share it with anyone
        except the providers below.
      </p>
      <p>
        <strong>Monthly reminder email.</strong> If — and only if — you switch
        it on in Settings, we send one email a month reminding you that your
        statement should be ready. We rely on your consent for this, and you can
        withdraw it at any time from the link in every email or from Settings
        &rarr; Reminders. The reminder contains no financial information: no
        balances, no totals, no category or account names. Your figures stay
        behind your login.
      </p>

      <h2>Where it is stored</h2>
      <p>
        Your data is stored with Supabase (database and authentication) and the
        application runs on Vercel (hosting). If you turn on the monthly
        reminder, Resend (email delivery) processes your email address for that
        purpose only — never the financial data you enter. These providers may
        process data outside the UK; where they do, transfers are protected by
        appropriate safeguards such as UK-approved standard contractual clauses
        under the providers&rsquo; data processing agreements.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Your data is kept for as long as your account exists. When you clear
        your data or delete your account, the records are permanently deleted
        from the live database immediately; residual copies may persist in our
        providers&rsquo; encrypted backups for a short period before being
        purged on their standard cycle.
      </p>

      <h2>Your rights</h2>
      <p>
        You can export, clear, or permanently delete your data at any time from
        Settings &rarr; Your data. Account deletion is permanent and removes
        your login and all associated records.
      </p>
      <p>
        Under UK data protection law you also have rights of access,
        rectification, erasure, restriction, portability, and objection. Most of
        these you can exercise yourself through the self-service tools above.
        You also have the right to complain to the Information
        Commissioner&rsquo;s Office (ico.org.uk).
      </p>

      <h2>Cookies</h2>
      <p>
        Balanced Money sets a single strictly-necessary cookie — your Supabase
        authentication session (<code>HttpOnly</code>, <code>Secure</code>,
        <code>SameSite=Lax</code>) — which keeps you signed in. We use no
        analytics, tracking, or advertising cookies, and we do not share your
        data for marketing. Because the only cookie is essential to providing
        the service, no cookie-consent banner is required.
      </p>

      <h2>Changes to this notice</h2>
      <p>
        We may update this notice from time to time. Changes take effect when
        the updated notice is posted on this page with a new effective date.
      </p>
    </main>
  );
}
