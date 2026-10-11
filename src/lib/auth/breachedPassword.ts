// Have I Been Pwned's range API, consulted at sign-up so a password already
// published in a breach corpus cannot be chosen here.
//
// Supabase offers the same check, but only on the Pro plan — recorded as an
// accepted hole in the Sep 2026 audit. That premise was wrong: the hole is
// Supabase doing it for us, not the check itself, which is free and is about
// thirty lines.
//
// k-anonymity: we SHA-1 the password, send the first five hex characters, and
// match the remaining thirty-five locally against the few hundred suffixes
// that come back. The password never leaves the process and neither does
// enough of its hash to identify it. `Add-Padding` asks HIBP to pad the
// response to a uniform size, so an observer cannot infer the prefix from the
// response length either.
// Overridable so the e2e suite can serve this from its own mock rather than
// reaching the real internet mid-test — the same reason Supabase Auth is
// mocked there. A tooling variable, never set in production; see the
// "Test/tooling vars" note in .env.example.
const RANGE_ENDPOINT =
  process.env.HIBP_RANGE_URL ?? "https://api.pwnedpasswords.com/range/";

// Sign-up must not hang on a third party. Past this, the answer is "unknown".
const TIMEOUT_MS = 2_000;

export type BreachVerdict = "safe" | "breached" | "unknown";

const sha1Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
};

/**
 * Whether this password appears in a known breach.
 *
 * Returns "unknown" rather than throwing when HIBP cannot be reached. The
 * caller treats that as permission to continue: a password that is probably
 * fine, refused because someone else's service is down, is a worse failure
 * than the one this is guarding against. Mirrors the rate limiter's
 * whenStoreFails: "allow" reasoning.
 */
export const checkPasswordBreach = async (
  password: string,
): Promise<BreachVerdict> => {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(`${RANGE_ENDPOINT}${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return "unknown";

    // Lines are "<SUFFIX>:<count>". Padding entries carry a count of 0, but a
    // real match is what we are looking for, so the count is not consulted.
    const body = await response.text();
    const breached = body
      .split("\n")
      .some((line) => line.split(":")[0]?.trim().toUpperCase() === suffix);

    return breached ? "breached" : "safe";
  } catch {
    return "unknown";
  }
};
