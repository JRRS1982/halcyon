import { requireTransactionsEnabled } from "@/lib/settings/server";
import { TransactionsView } from "./TransactionsView";

// Gated route. requireTransactionsEnabled redirects to /sign-in when signed
// out and to /dashboard when the transactions feature is disabled, so a stale
// bookmark or direct URL never exposes the page. The nav link is likewise
// hidden when off — but this server gate is the real boundary.
export default async function TransactionsPage() {
  await requireTransactionsEnabled();
  return <TransactionsView />;
}
