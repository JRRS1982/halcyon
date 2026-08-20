import type { Metadata } from "next";
import { unsubscribeTokenExists } from "@/lib/email/subscriptions";
import { confirmUnsubscribe } from "./actions";
import { UnsubscribePanel } from "./UnsubscribePanel";

export const metadata: Metadata = {
  title: "Unsubscribe · Balanced Money",
  // Reachable only from a link in an email, and the URL carries a token.
  robots: { index: false, follow: false },
};

// The token makes this per-request; there is nothing to prerender.
export const dynamic = "force-dynamic";

/**
 * Where the "stop these reminders" link in the email lands.
 *
 * No sign-in required, on purpose: making someone log in to stop email they
 * didn't want is a dark pattern, and the person who most wants out is the one
 * least likely to remember a password. The token in the URL is the only thing
 * it can do — turn one account's reminder off.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string }>;
}) {
  const { token = "", done } = await searchParams;

  // Looked up before anything is shown, so a link that matches nobody says so
  // straight away rather than offering a button that turns out to do nothing.
  // A read only — the change itself needs the POST below.
  const recognised = done ? true : await unsubscribeTokenExists(token);

  return (
    <UnsubscribePanel
      token={token}
      done={done ?? (recognised ? undefined : "unknown")}
      action={confirmUnsubscribe}
    />
  );
}
