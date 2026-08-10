import { Guide } from "./Guide";

// Public on purpose: it doubles as the "what is this?" page for a prospect who
// isn't ready to sign up, and as reference material a signed-in user comes
// back to. No session lookup, so it stays cheap to serve.
export const metadata = {
  title: "How it works — Balanced Money",
  description:
    "The monthly rhythm, what each section is for, and how transactions, budget, balance and the dashboard feed each other.",
};

export default function GuidePage() {
  return <Guide />;
}
