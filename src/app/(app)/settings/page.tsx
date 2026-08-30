import { sectionLabel } from "@/lib/categories/sections";
import { prisma } from "@/lib/prisma";
import {
  CURRENCY_CODES,
  CURRENCY_META,
  NUMBER_FORMAT_SPEC,
  NUMBER_FORMATS,
  symbolFor,
} from "@/lib/settings/currency";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { getOrProvisionCategories } from "@/lib/transactions/server";
import { AccountManager, type ManagedAccount } from "./AccountManager";
import { updateSettings } from "./actions";
import { CategoryManager, type ManagedCategory } from "./CategoryManager";
import { DashboardSettings } from "./DashboardSettings";
import { DataPrivacy } from "./DataPrivacy";
import { SettingsForm } from "./SettingsForm";

// Human labels for each number-format preset (the structural description; the
// live example is appended with the user's currency symbol below).
const NUMBER_FORMAT_LABELS: Record<(typeof NUMBER_FORMATS)[number], string> = {
  COMMA_0: "Comma thousands, no decimals",
  COMMA_2: "Comma thousands, 2 decimals",
  DOT_0: "Dot thousands, no decimals",
  DOT_2: "Dot thousands, 2 decimals",
  SPACE_0: "Space thousands, no decimals",
  SPACE_2: "Space thousands, 2 decimals",
};

// Protected by middleware → /sign-in?next=/settings if no session.
export default async function SettingsPage() {
  const {
    userId,
    currency,
    numberFormat,
    transactionsEnabled,
    transfersEnabled,
    hiddenCharts,
    themePreference,
    monthlyReminderEnabled,
    monthlyReminderDay,
  } = await getCurrentUserSettings();
  const symbol = symbolFor(currency);

  // Provision categories from the budget if none exist yet (idempotent), then
  // load them with usage counts for the management section. Categories are
  // editable regardless of the transactions toggle.
  await getOrProvisionCategories(userId);
  const [categoryRows, counts] = await Promise.all([
    prisma.category.findMany({
      // Categories are never transfers or repayments — those key on
      // accounts, not categories — so this excludes the widened ItemType
      // members that can never actually appear on a Category row.
      where: { userId, deletedAt: null, type: { in: ["INCOME", "EXPENSE"] } },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
      select: {
        id: true,
        label: true,
        type: true,
        section: true,
      },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, deletedAt: null, categoryId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const countByCategory: Record<string, number> = {};
  for (const c of counts) {
    if (c.categoryId) countByCategory[c.categoryId] = c._count._all;
  }

  const managedCategories: ManagedCategory[] = categoryRows.flatMap((c) => {
    // The query's `where` already excludes anything but INCOME/EXPENSE, but
    // ItemType is shared with BudgetItem/BudgetTemplateItem, so the
    // Prisma-generated type for `c.type` is still the full enum. This
    // narrows it back down without a cast; unreachable in practice.
    if (c.type !== "INCOME" && c.type !== "EXPENSE") return [];
    return [
      {
        id: c.id,
        label: c.label,
        type: c.type,
        section: c.section,
        sectionLabel: sectionLabel(c.section),
        txnCount: countByCategory[c.id] ?? 0,
      },
    ];
  });

  // Accounts with both reference counts, so the manager can block deletion of an
  // account that still owns transactions or is named as a transfer counterparty.
  const [accountRows, archivedAccounts] = await Promise.all([
    prisma.account.findMany({
      where: { userId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true, canImportTransactions: true },
    }),
    prisma.account.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const [ownedCounts, counterpartyCounts] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { userId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.transaction.groupBy({
      by: ["transferAccountId"],
      where: { userId, deletedAt: null, transferAccountId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const ownedByAccount: Record<string, number> = {};
  for (const c of ownedCounts) ownedByAccount[c.accountId] = c._count._all;
  const counterpartyByAccount: Record<string, number> = {};
  for (const c of counterpartyCounts) {
    if (c.transferAccountId)
      counterpartyByAccount[c.transferAccountId] = c._count._all;
  }
  const managedAccounts: ManagedAccount[] = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    ownedCount: ownedByAccount[a.id] ?? 0,
    counterpartyCount: counterpartyByAccount[a.id] ?? 0,
    canImportTransactions: a.canImportTransactions,
  }));

  const currencyOptions = CURRENCY_CODES.map((code) => {
    const meta = CURRENCY_META[code];
    return {
      value: code,
      label: meta.symbol
        ? `${meta.symbol} ${code} · ${meta.name}`
        : `${code} · ${meta.name}`,
    };
  });

  const numberFormatOptions = NUMBER_FORMATS.map((fmt) => ({
    value: fmt,
    label: `${symbol}${NUMBER_FORMAT_SPEC[fmt].example} · ${NUMBER_FORMAT_LABELS[fmt]}`,
  }));

  // One landmark around all five sections. Each supplies its own <section>
  // and heading, so the page reads as a single region with five parts.
  return (
    <main>
      <SettingsForm
        action={updateSettings}
        currency={currency}
        currencyOptions={currencyOptions}
        numberFormat={numberFormat}
        numberFormatOptions={numberFormatOptions}
        transactionsEnabled={transactionsEnabled}
        transfersEnabled={transfersEnabled}
        themePreference={themePreference}
        monthlyReminderEnabled={monthlyReminderEnabled}
        monthlyReminderDay={monthlyReminderDay}
      />
      <DashboardSettings hiddenCharts={hiddenCharts} />
      <CategoryManager categories={managedCategories} />
      <AccountManager accounts={managedAccounts} archived={archivedAccounts} />
      <DataPrivacy />
    </main>
  );
}
