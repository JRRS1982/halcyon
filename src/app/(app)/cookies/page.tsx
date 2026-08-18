export const metadata = { title: "Cookie Policy — Balanced Money" };

// The honest cookie policy of a service that sets almost no cookies. Every
// cookie named here must exist in the code: the Supabase auth session
// (@supabase/ssr), the bm_activity timeout cookie (src/lib/auth/
// sessionTimeout.ts), and the transient PKCE cookie during OAuth sign-in.
export default function CookiesPage() {
  return (
    <main
      style={{ maxWidth: "60ch", margin: "0 auto", padding: "2rem 1.5rem" }}
    >
      <h1>Cookie Policy</h1>
      <p>
        <em>Effective date: 18 August 2026</em>
      </p>
      <p>
        Cookies are small text files a website stores in your browser. This page
        lists every cookie Balanced Money sets, what each one is for, and how
        long it lives. It should be read alongside the{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>The short version</h2>
      <p>
        We set only strictly-necessary, first-party cookies — the ones that keep
        you signed in and sign you out again when your session should end. There
        are no analytics cookies, no advertising cookies, and no third-party
        tracking of any kind. Because every cookie we set is essential to
        providing the service, UK law does not require a consent banner for them
        — which is why you never see one.
      </p>

      <h2>The cookies we use</h2>
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Cookie</th>
            <th style={{ textAlign: "left" }}>Purpose</th>
            <th style={{ textAlign: "left" }}>How long</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>sb-*-auth-token</code>
            </td>
            <td>
              Your Supabase Auth session — proves to the server that you are
              signed in. Set when you sign in; removed when you sign out.
            </td>
            <td>
              Until you sign out. Regardless of the cookie, the app ends your
              session after 6 hours of inactivity, or 24 hours at most.
            </td>
          </tr>
          <tr>
            <td>
              <code>bm_activity</code>
            </td>
            <td>
              Records when your session started and was last active, so the time
              limits above can be enforced. Contains two timestamps and nothing
              else.
            </td>
            <td>24 hours.</td>
          </tr>
          <tr>
            <td>
              <code>sb-*-code-verifier</code>
            </td>
            <td>
              A one-time value that secures the sign-in handshake if you use
              &ldquo;Continue with Google&rdquo;.
            </td>
            <td>Minutes — deleted once sign-in completes.</td>
          </tr>
        </tbody>
      </table>
      <p>
        All of these are first-party cookies, set by balanced.money itself. The{" "}
        <code>sb-*</code> names include your Supabase project reference, and a
        large session may be split across numbered chunks (
        <code>sb-*-auth-token.0</code>, <code>.1</code>) — those chunks are the
        same cookie.
      </p>

      <h2>What we don&rsquo;t use</h2>
      <p>
        No analytics or measurement cookies (no Google Analytics or equivalent),
        no advertising or retargeting pixels, no social-media embeds that set
        their own cookies, no A/B-testing tools, no session recording, and no
        local-storage tracking workarounds. Signed out, on the marketing pages,
        we set no cookies at all.
      </p>

      <h2>Managing cookies</h2>
      <p>
        You can block or delete cookies in your browser&rsquo;s settings at any
        time. Because the cookies above are what keeps you signed in, blocking
        them means you won&rsquo;t be able to use your account — everything else
        on the site will still work. Deleting them simply signs you out.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we ever add a cookie, it will be listed here first, with a new
        effective date — and if it were anything other than strictly necessary,
        we would ask for your consent before setting it.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about cookies:{" "}
        <a href="mailto:hello@balanced.money">hello@balanced.money</a>.
      </p>
    </main>
  );
}
