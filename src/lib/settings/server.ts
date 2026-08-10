import "server-only";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_THEME_PREFERENCE,
  type ThemePreference,
  isThemePreference,
} from "@/lib/settings/theme";
import { getCurrentUser } from "@/lib/supabase/user";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  type CurrencyCode,
  DEFAULT_CURRENCY,
  DEFAULT_NUMBER_FORMAT,
  type NumberFormat,
  isCurrencyCode,
  isNumberFormat,
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
async function provisionUserSettings(userId: string) {
  await prisma.$transaction([
    prisma.user.createMany({ data: [{ id: userId }], skipDuplicates: true }),
    prisma.userSettings.createMany({
      data: [{ userId }],
      skipDuplicates: true,
    }),
  ]);

  return prisma.userSettings.findUniqueOrThrow({ where: { userId } });
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
    planVisible: boolean;
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
      planVisible: row.planVisible,
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

// Whether the signed-in user has the Plan nav link visible. Used by the root
// layout to decide whether to show the Plan nav link. Defaults true (the Plan
// feature is on by default). Returns true when there's no settings row yet.
export async function isPlanVisible(userId: string): Promise<boolean> {
  const row = await prisma.userSettings.findUnique({
    where: { userId },
    select: { planVisible: true },
  });
  return row?.planVisible ?? true;
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
 * single-flag helpers above: transactions off, plan on.
 */
export async function getLayoutSettings(userId: string | undefined): Promise<{
  transactionsEnabled: boolean;
  planVisible: boolean;
  themePreference: ThemePreference;
}> {
  if (!userId)
    return {
      transactionsEnabled: false,
      planVisible: false,
      themePreference: DEFAULT_THEME_PREFERENCE,
    };

  const row = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      transactionsEnabled: true,
      planVisible: true,
      themePreference: true,
    },
  });
  return {
    transactionsEnabled: row?.transactionsEnabled ?? false,
    planVisible: row?.planVisible ?? true,
    themePreference: isThemePreference(row?.themePreference)
      ? row.themePreference
      : DEFAULT_THEME_PREFERENCE,
  };
}
