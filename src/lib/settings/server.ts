import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ensurePeriodForMonthIn } from "@/lib/budget/ensurePeriod";
import { currentMonthRange } from "@/lib/budget/period";
import { sectionFor } from "@/lib/categories/sections";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  STARTER_BUDGET_CATEGORIES,
} from "@/lib/onboarding/defaults";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  type ThemePreference,
} from "@/lib/settings/theme";
import { getCurrentUser } from "@/lib/supabase/user";
import {
  type CurrencyCode,
  DEFAULT_CURRENCY,
  DEFAULT_NUMBER_FORMAT,
  isCurrencyCode,
  isNumberFormat,
  type NumberFormat,
} from "./currency";

// Creates the app-side profile + settings rows for a user who has neither yet,
// and returns the settings row. Only reached on a miss — see the caller.
//
// In production the `handle_new_user` trigger on auth.users creates the User
// row (see ADR-002 / the supabase_auth_integration migration). But that trigger
// lives in the Supabase database; when Prisma points at a separate DB (e.g.
// local Docker Postgres with auth still on Supabase), the row is never created
// locally and FK constraints fail. This idempotent insert mirrors the trigger
// as an app-side fallback so sign-in works regardless of which DB Prisma
// targets. Trigger-first, app-fallback.
//
// `createMany({ skipDuplicates })` compiles to INSERT ... ON CONFLICT DO
// NOTHING — atomic. `upsert` does a non-atomic select-then-insert, so two
// concurrent first-time requests (a page and its prefetch, or parallel server
// components) both INSERT and all but one fail with P2002. That still matters
// now the caller looks first: concurrent first-time requests all miss the
// look-up and arrive here together.
//
// Both inserts run in ONE transaction so the pair is atomic too: nothing can
// observe User created but UserSettings not-yet-created, which would make the
// UserSettings insert trip its userId FK. This matters under the e2e harness,
// which `TRUNCATE "User" CASCADE`s between tests — a truncate landing between
// two separate statements (for an in-flight request) would delete the User
// before UserSettings references it. User first, since UserSettings FKs it.
//
// The starter data (categories, accounts, first budget sheet) goes in the same
// transaction, gated on the UserSettings insert having actually happened. That
// gate is load-bearing: `skipDuplicates` can dedupe User and UserSettings
// because their primary key is the userId, but nothing makes a category unique
// per user, so two concurrent first-time requests would each insert a full set
// and the user would open Settings to every category twice. `createMany`
// returns the row count, so the request that created the settings row is the
// one that seeds; the loser sees 0 and leaves it alone.
async function provisionUserSettings(userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.user.createMany({ data: [{ id: userId }], skipDuplicates: true });
    const { count } = await tx.userSettings.createMany({
      data: [{ userId }],
      skipDuplicates: true,
    });
    // Lost the race — a concurrent request is seeding this user right now.
    if (count === 0) return;
    await seedStarterData(tx, userId);
  });

  return prisma.userSettings.findUniqueOrThrow({ where: { userId } });
}

// Writes the default categories and accounts, plus the current month's budget
// sheet as £0 rows, for a user who has just been created.
//
// Category ids are generated here rather than left to the database default, so
// the budget rows can carry `categoryId` without reading the categories back —
// which keeps the whole thing to three statements inside the caller's
// transaction. The link matters: a categoryId-linked row is what lets the
// transactions feature overlay a computed actual on it later.
export async function seedStarterData(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const categories = DEFAULT_CATEGORIES.map((c, sortOrder) => ({
    id: randomUUID(),
    userId,
    label: c.label,
    type: c.type,
    sortOrder,
    section: sectionFor(c.type, c.section),
  }));

  await tx.category.createMany({ data: categories });
  await tx.account.createMany({
    data: DEFAULT_ACCOUNTS.map((name) => ({ userId, name })),
  });

  const byLabel = new Map(categories.map((c) => [c.label, c]));
  const period = await ensurePeriodForMonthIn(tx, userId, currentMonthRange());

  await tx.budgetItem.createMany({
    data: STARTER_BUDGET_CATEGORIES.map((starter, sortOrder) => {
      const category = byLabel.get(starter.label);
      if (!category) {
        throw new Error(`Starter budget category missing: ${starter.label}`);
      }
      return {
        periodId: period.id,
        categoryId: category.id,
        type: category.type,
        section: category.section,
        label: category.label,
        budget: 0,
        sortOrder,
      };
    }),
  });
}

// Returns the signed-in user's settings, creating the row lazily on first
// access. Safe to call from any server component / server action.
//
// `cache()` scopes the result to a single request, so the several callers that
// each want one preference — a page and the gate in front of it, say — share
// one read instead of repeating it. It does NOT cache across requests, so a
// settings change is visible on the next one.
//
// The look-up runs before the lazy-create rather than after it. Provisioning is
// a first-request-ever concern, but as an unconditional prelude it charged
// every later request a write transaction to be told the rows were already
// there. A read that usually hits costs one query; only a miss pays for the
// insert.
export const getCurrentUserSettings = cache(
  async (): Promise<{
    userId: string;
    currency: CurrencyCode;
    numberFormat: NumberFormat;
    transactionsEnabled: boolean;
    transfersEnabled: boolean;
    hiddenCharts: string[];
    themePreference: ThemePreference;
    monthlyReminderEnabled: boolean;
    monthlyReminderDay: number;
  }> => {
    const user = await getCurrentUser();
    if (!user) redirect("/sign-in");

    const row =
      (await prisma.userSettings.findUnique({ where: { userId: user.id } })) ??
      (await provisionUserSettings(user.id));

    return {
      userId: user.id,
      currency: isCurrencyCode(row.currency) ? row.currency : DEFAULT_CURRENCY,
      numberFormat: isNumberFormat(row.numberFormat)
        ? row.numberFormat
        : DEFAULT_NUMBER_FORMAT,
      transactionsEnabled: row.transactionsEnabled,
      transfersEnabled: row.transfersEnabled,
      hiddenCharts: row.hiddenCharts,
      themePreference: isThemePreference(row.themePreference)
        ? row.themePreference
        : "SYSTEM",
      monthlyReminderEnabled: row.monthlyReminderEnabled,
      monthlyReminderDay: row.monthlyReminderDay,
    };
  },
);

// Gate for the transactions feature: ensures a signed-in user (via
// getCurrentUserSettings) who has the feature enabled, redirecting to
// /dashboard otherwise. Call at the top of the /transactions page and every
// transactions server action — never trust the hidden nav link alone.
export async function requireTransactionsEnabled(): Promise<string> {
  const { userId, transactionsEnabled } = await getCurrentUserSettings();
  if (!transactionsEnabled) redirect("/dashboard");
  return userId;
}

// Whether the signed-in user has the transactions feature switched on, without
// the redirect-if-signed-out behaviour of getCurrentUserSettings. Used by the
// root layout (which renders for signed-out users too) to decide whether to
// show the Transactions nav link. Returns false when there's no user or no
// settings row yet.
export async function isTransactionsEnabled(userId: string): Promise<boolean> {
  const row = await prisma.userSettings.findUnique({
    where: { userId },
    select: { transactionsEnabled: true },
  });
  return row?.transactionsEnabled ?? false;
}

/**
 * Everything the app layout needs about a visitor, in one read: which nav links
 * to show and which colour scheme to paint.
 *
 * Separate from getCurrentUserSettings because the layout renders for
 * signed-out visitors too, and that function redirects when there is no user.
 * A visitor with no account gets no app links and follows their OS.
 *
 * One query rather than two. The layout renders on every request and used to
 * ask in two goes — first the nav flags, then the theme — which is two
 * sequential round trips for three columns of the same row. Defaults match the
 * single-flag helper above: transactions off.
 */
export async function getLayoutSettings(userId: string | undefined): Promise<{
  transactionsEnabled: boolean;
  themePreference: ThemePreference;
}> {
  if (!userId)
    return {
      transactionsEnabled: false,
      themePreference: DEFAULT_THEME_PREFERENCE,
    };

  // Provisions on a miss, exactly as getCurrentUserSettings does. A read-only
  // lookup here reported `transactionsEnabled: false` for any user whose row
  // did not exist yet, so the nav rendered without the Transactions link while
  // the page beside it created the row and rendered fine — wrong on a new
  // user's very first authenticated page, and intermittently wrong afterwards
  // whenever a render observed the row before that insert had committed.
  const row =
    (await prisma.userSettings.findUnique({
      where: { userId },
      select: {
        transactionsEnabled: true,
        themePreference: true,
      },
    })) ?? (await provisionUserSettings(userId));
  return {
    transactionsEnabled: row?.transactionsEnabled ?? false,
    themePreference: isThemePreference(row?.themePreference)
      ? row.themePreference
      : DEFAULT_THEME_PREFERENCE,
  };
}
