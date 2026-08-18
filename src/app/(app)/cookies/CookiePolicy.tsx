"use client";

import {
  LegalAnchor,
  LegalBody,
  LegalHeading,
  LegalLink,
  LegalPage,
  LegalSection,
  LegalTable,
  LegalTableWrap,
} from "@/components/legal/LegalPage";

// The honest cookie policy of a service that sets almost no cookies. Every
// cookie named here must exist in the code: the Supabase auth session
// (@supabase/ssr), the bm_activity timeout cookie (src/lib/auth/
// sessionTimeout.ts), and the transient PKCE cookie during OAuth sign-in.
export function CookiePolicy() {
  return (
    <LegalPage title="Cookie Policy" effectiveDate="18 August 2026">
      <LegalBody>
        Cookies are small text files a website stores in your browser. This page
        lists every cookie Balanced Money sets, what each one is for, and how
        long it lives. It should be read alongside the{" "}
        <LegalLink href="/privacy">Privacy Policy</LegalLink>.
      </LegalBody>

      <LegalSection>
        <LegalHeading>The short version</LegalHeading>
        <LegalBody>
          We set only strictly-necessary, first-party cookies — the ones that
          keep you signed in and sign you out again when your session should
          end. There are no analytics cookies, no advertising cookies, and no
          third-party tracking of any kind. Because every cookie we set is
          essential to providing the service, UK law does not require a consent
          banner for them — which is why you never see one.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>The cookies we use</LegalHeading>
        <LegalTableWrap>
          <LegalTable>
            <thead>
              <tr>
                <th>Cookie</th>
                <th>Purpose</th>
                <th>How long</th>
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
                  Until you sign out. Regardless of the cookie, the app ends
                  your session after 6 hours of inactivity, or 24 hours at most.
                </td>
              </tr>
              <tr>
                <td>
                  <code>bm_activity</code>
                </td>
                <td>
                  Records when your session started and was last active, so the
                  time limits above can be enforced. Contains two timestamps and
                  nothing else.
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
          </LegalTable>
        </LegalTableWrap>
        <LegalBody>
          All of these are first-party cookies, set by balanced.money itself.
          The <code>sb-*</code> names include your Supabase project reference,
          and a large session may be split across numbered chunks (
          <code>sb-*-auth-token.0</code>, <code>.1</code>) — those chunks are
          the same cookie.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>What we don&rsquo;t use</LegalHeading>
        <LegalBody>
          No analytics or measurement cookies (no Google Analytics or
          equivalent), no advertising or retargeting pixels, no social-media
          embeds that set their own cookies, no A/B-testing tools, no session
          recording, and no local-storage tracking workarounds. Signed out, on
          the marketing pages, we set no cookies at all.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Managing cookies</LegalHeading>
        <LegalBody>
          You can block or delete cookies in your browser&rsquo;s settings at
          any time. Because the cookies above are what keeps you signed in,
          blocking them means you won&rsquo;t be able to use your account —
          everything else on the site will still work. Deleting them simply
          signs you out.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Changes to this policy</LegalHeading>
        <LegalBody>
          If we ever add a cookie, it will be listed here first, with a new
          effective date — and if it were anything other than strictly
          necessary, we would ask for your consent before setting it.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Contact</LegalHeading>
        <LegalBody>
          Questions about cookies:{" "}
          <LegalAnchor href="mailto:hello@balanced.money">
            hello@balanced.money
          </LegalAnchor>
          .
        </LegalBody>
      </LegalSection>
    </LegalPage>
  );
}
