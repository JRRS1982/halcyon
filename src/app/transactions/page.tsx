import { prisma } from "@/lib/prisma";
import { requireTransactionsEnabled } from "@/lib/settings/server";
import {
  countUncategorized,
  getOrProvisionCategories,
  getTransactionsPage,
} from "@/lib/transactions/server";
import { TransactionsView } from "./TransactionsView";

// Gated route. requireTransactionsEnabled redirects to /sign-in when signed
// out and to /dashboard when the transactions feature is disabled, so a stale
// bookmark or direct URL never exposes the page. The nav link is likewise
// hidden when off — but this server gate is the real boundary.
export default async function TransactionsPage() {
  const userId = await requireTransactionsEnabled();

  const [accounts, categories, initialPage, uncategorizedCount] =
    await Promise.all([
      prisma.account.findMany({
        where: { userId, deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      getOrProvisionCategories(userId),
      getTransactionsPage(userId),
      countUncategorized(userId),
    ]);

  return (
    <TransactionsView
      accounts={accounts}
      categories={categories}
      initialPage={initialPage}
      uncategorizedCount={uncategorizedCount}
    />
  );
}
