import { prisma } from "@/lib/prisma";
import {
  getCurrentUserSettings,
  requireTransactionsEnabled,
} from "@/lib/settings/server";
import {
  PAGE_SIZE,
  parseLedgerSearchParams,
} from "@/lib/transactions/pagination";
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
//
// The ledger query (page / search / filter / sort) lives in the URL, so this
// component renders exactly the requested page of transactions.
export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireTransactionsEnabled();
  const { transfersEnabled } = await getCurrentUserSettings();
  const query = parseLedgerSearchParams(await searchParams);

  const [accounts, categories, page, uncategorizedCount] = await Promise.all([
    prisma.account.findMany({
      where: { userId, deletedAt: null, canImportTransactions: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getOrProvisionCategories(userId),
    getTransactionsPage(userId, {
      offset: (query.page - 1) * PAGE_SIZE,
      search: query.search,
      onlyUncategorized: query.onlyUncategorized,
      sortColumn: query.sortColumn,
      sortDir: query.sortDir,
    }),
    countUncategorized(userId),
  ]);

  return (
    <TransactionsView
      accounts={accounts}
      categories={categories}
      page={page}
      query={query}
      uncategorizedCount={uncategorizedCount}
      transfersEnabled={transfersEnabled}
    />
  );
}
