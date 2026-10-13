import { SignInForm } from "@/components/auth/SignInForm";
import { authNotice } from "@/lib/auth/authNotices";
import { POST_AUTH_LANDING } from "@/lib/auth/landing";

// Set by the proxy's expiry redirect and by the client-side idle timer. Looking
// the reason up in a fixed table means an arbitrary `?timeout=` value renders
// nothing rather than being echoed back to the page.
const TIMEOUT_NOTICES: Record<string, string> = {
  idle: "You were signed out after a period of inactivity.",
  absolute: "You were signed out because your session reached its time limit.",
  // Not a time limit — the session's age was unreadable, so it was ended
  // rather than trusted. Honest about the cause without inviting alarm.
  unreadable:
    "We couldn't confirm how long you'd been signed in, so we signed you out. Please sign in again.",
};

type Props = {
  searchParams: Promise<{ error?: string; next?: string; timeout?: string }>;
};

export default async function SignInPage(props: Props) {
  const searchParams = await props.searchParams;
  const next = searchParams.next ?? POST_AUTH_LANDING;
  // Object.hasOwn for the same reason authNotice uses it: a plain index finds
  // Object.prototype members, so `?timeout=__proto__` returned a truthy object
  // and React threw rendering it as a child — taking out the unauthenticated
  // sign-in page. No attacker text is reachable this way, so it is not the
  // phishing echo `?error=` was; it is the same unguarded lookup left in the
  // sibling parameter three lines away.
  const notice =
    searchParams.timeout !== undefined &&
    Object.hasOwn(TIMEOUT_NOTICES, searchParams.timeout)
      ? TIMEOUT_NOTICES[searchParams.timeout]
      : undefined;

  return (
    <SignInForm
      next={next}
      error={authNotice(searchParams.error)}
      notice={notice}
    />
  );
}
