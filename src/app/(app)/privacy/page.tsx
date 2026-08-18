export const metadata = { title: "Privacy Policy — Balanced Money" };

// Plain-language, maximally explicit privacy notice. The drafting principle:
// name every category of data, every processor, every lawful basis, and every
// right — and say plainly what we do NOT do. Keep the claims in sync with the
// code (dataActions.ts, sessionTimeout.ts, the reminder in src/lib/email/).
export default function PrivacyPage() {
  return (
    <main
      style={{ maxWidth: "60ch", margin: "0 auto", padding: "2rem 1.5rem" }}
    >
      <h1>Privacy Policy</h1>
      <p>
        <em>Effective date: 18 August 2026</em>
      </p>
      <p>
        Balanced Money exists to help you understand your own money — not to
        monetise your data. This notice explains, as plainly and completely as
        we can, what personal data we collect, why we collect it, who touches
        it, and the rights you have over it. It should be read alongside the{" "}
        <a href="/terms">Terms of Service</a> and the{" "}
        <a href="/cookies">Cookie Policy</a>.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>
          We collect your email address and the financial figures you choose to
          enter. Nothing else identifies you.
        </li>
        <li>
          We use no analytics, no tracking, no advertising, and no AI. We never
          sell or share your data for marketing.
        </li>
        <li>
          Three service providers process data on our behalf — Supabase, Vercel,
          and Resend — and only to run the service.
        </li>
        <li>
          You can export, clear, or permanently delete everything yourself, at
          any time, from Settings &rarr; Your data.
        </li>
      </ul>

      <h2>Who we are</h2>
      <p>
        Balanced Money (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a personal
        finance service operated from the United Kingdom and available at
        balanced.money. We are the data controller for the personal data
        described in this notice: we decide what is collected and why, and we
        are responsible to you for it. You can contact us about anything in this
        notice at <a href="mailto:hello@balanced.money">hello@balanced.money</a>
        .
      </p>

      <h2>The data we collect</h2>
      <p>
        We do collect user data. Specifically, and exhaustively, it is this:
      </p>
      <p>
        <strong>Account data.</strong> Your email address and sign-in
        credentials. Authentication is handled by Supabase Auth: passwords are
        stored only as secure hashes and are never visible to us. If you sign in
        with Google, we receive your email address and basic profile details
        from Google; we never see your Google password.
      </p>
      <p>
        <strong>Financial data you enter.</strong> The budgets, balance sheets,
        transactions, categories, and accounts you add, including rows imported
        from bank-statement CSV files. If you use the Plan feature, this also
        includes the details you give it — your date of birth, planned
        retirement age, and the incomes, expenses, assets, and liabilities you
        model. All of it is private to your account and is stored for one
        purpose only: showing it back to you.
      </p>
      <p>
        <strong>Imported files.</strong> When you import a CSV, the file is read
        once, in memory, and the rows you confirm become transactions in your
        account. We do not keep the file itself — there is no file storage,
        public or private, anywhere in the service. We keep only the transaction
        rows, the columns you chose to keep, and the file&rsquo;s name (so you
        can recognise and reverse an import later).
      </p>
      <p>
        <strong>Technical data.</strong> Our hosting providers keep standard,
        short-lived server logs (such as IP address, browser type, and request
        times) for security and operations. We do not use these to identify or
        profile you.
      </p>
      <p>
        <strong>What we do not collect:</strong> no analytics or usage tracking,
        no advertising identifiers, no device fingerprinting, no location data,
        no contacts, no data bought from or enriched by third parties, and no
        connection to your real bank accounts — the service only ever knows the
        figures you type or import yourself.
      </p>

      <h2>How we use your data, and our lawful basis</h2>
      <p>
        UK data protection law requires a lawful basis for each use. Here is
        each use, and its basis:
      </p>
      <ul>
        <li>
          <strong>Providing the service you signed up for</strong> — storing
          your figures and showing them back to you as sheets, charts, and
          plans. Basis: performance of a contract.
        </li>
        <li>
          <strong>Keeping the service secure and working</strong> — server logs,
          session management, and abuse prevention. Basis: our legitimate
          interest in running a safe, reliable service.
        </li>
        <li>
          <strong>The monthly reminder email</strong> — if, and only if, you
          switch it on in Settings, we send one email a month reminding you that
          your statement should be ready. Basis: your consent, which you can
          withdraw at any time from the link in every email or from Settings
          &rarr; Reminders. The reminder contains no financial information — no
          balances, no totals, no category or account names.
        </li>
      </ul>
      <p>
        That is the complete list. We do not use your data for marketing or
        advertising, we do not sell it or rent it, we do not share it with
        anyone except the processors named below, and we send no emails other
        than account emails (such as confirmation and password reset) and the
        opt-in reminder above.
      </p>

      <h2>AI and automated decision-making</h2>
      <p>
        We do not use artificial intelligence anywhere in the service. Your data
        is never used to train AI or machine-learning models, never sent to an
        AI provider, and never subject to automated decision-making or profiling
        of any kind. Every chart and forecast you see is plain arithmetic over
        the figures you entered, computed only to display to you.
      </p>

      <h2>Who processes your data</h2>
      <p>
        We run the service on three specialist providers. Each acts as our data
        processor: they may only process your data on our instructions, under a
        data processing agreement, and never for their own purposes.
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Provider</th>
            <th style={{ textAlign: "left" }}>What it does</th>
            <th style={{ textAlign: "left" }}>What it handles</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase</td>
            <td>Database and authentication</td>
            <td>
              Everything above: your account data and the financial data you
              enter
            </td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>Hosting and serving the application</td>
            <td>Request data and server logs; your data passes through it</td>
          </tr>
          <tr>
            <td>Resend</td>
            <td>Email delivery</td>
            <td>
              Your email address only, and only if you turn the monthly reminder
              on — never your financial data
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        If you choose to sign in with Google, Google acts as your identity
        provider under its own privacy policy; we receive only your email
        address and basic profile details from it.
      </p>

      <h2>Where your data goes</h2>
      <p>
        These providers may process data outside the UK, including in the United
        States. Where they do, the transfers are protected by UK-approved
        safeguards — such as the UK International Data Transfer Agreement or
        Addendum, or adequacy regulations — under each provider&rsquo;s data
        processing agreement.
      </p>

      <h2>How your data is protected</h2>
      <p>
        All traffic to and from the service is encrypted in transit (TLS), and
        our database provider encrypts data at rest. Access to your figures
        requires your login; sessions expire automatically after 6 hours of
        inactivity and after 24 hours at most. No security is absolute, but the
        service is deliberately built to hold as little about you as possible —
        the less we hold, the less can go wrong.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Your data is kept only while your account exists. When you clear your
        data or delete your account, the records are hard-deleted from the live
        database immediately — not flagged, not archived, not retained
        &ldquo;for analytics&rdquo;. This includes imported transactions and
        import history, and everything the Plan feature holds. Residual copies
        may persist in our providers&rsquo; encrypted backups for a short period
        before being purged on their standard cycle.
      </p>

      <h2>Your rights and your controls</h2>
      <p>
        The fastest way to exercise your rights is self-service — no email, no
        waiting, no one to convince. From Settings &rarr; Your data you can:
      </p>
      <ul>
        <li>
          <strong>Export</strong> — download everything we hold about you as a
          single JSON file (your right to access and portability);
        </li>
        <li>
          <strong>Clear</strong> — permanently delete all your financial records
          while keeping your login;
        </li>
        <li>
          <strong>Delete your account</strong> — permanently delete everything,
          including your login and email address (your right to erasure).
          Deleting takes no more effort than signing up did.
        </li>
      </ul>
      <p>
        Under UK data protection law you also have the rights of access,
        rectification, erasure, restriction, portability, objection, and — for
        the reminder email — withdrawal of consent. For anything the
        self-service tools don&rsquo;t cover, email{" "}
        <a href="mailto:hello@balanced.money">hello@balanced.money</a> and we
        will respond within one month. You also have the right to complain to
        the UK Information Commissioner&rsquo;s Office at{" "}
        <a href="https://ico.org.uk">ico.org.uk</a>.
      </p>

      <h2>Children</h2>
      <p>
        The service is for adults managing their own finances. You must be at
        least 18 to create an account, and we do not knowingly collect data
        about anyone under 18. If you believe a child has created an account,
        contact us and we will delete it.
      </p>

      <h2>Cookies</h2>
      <p>
        Balanced Money sets only strictly-necessary first-party cookies — the
        Supabase authentication session that keeps you signed in, and a small
        activity cookie that enforces the session time limits above. We use no
        analytics, tracking, or advertising cookies, which is why you see no
        cookie-consent banner: there is nothing to consent to. The full list,
        with names and lifetimes, is in the <a href="/cookies">Cookie Policy</a>
        .
      </p>

      <h2>Changes to this notice</h2>
      <p>
        We may update this notice from time to time. Changes take effect when
        the updated notice is posted on this page with a new effective date; if
        a change meaningfully reduces your rights or expands what we collect, we
        will say so prominently rather than change it quietly.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, concerns, or rights requests:{" "}
        <a href="mailto:hello@balanced.money">hello@balanced.money</a>.
      </p>
    </main>
  );
}
