import "server-only";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  type CurrencyCode,
  DEFAULT_CURRENCY,
  DEFAULT_NUMBER_FORMAT,
  type NumberFormat,
  isCurrencyCode,
  isNumberFormat,
} from "./currency";

// Returns the signed-in user's settings, creating the row lazily on first
// access. Safe to call from any server component / server action.
export async function getCurrentUserSettings(): Promise<{
  userId: string;
  currency: CurrencyCode;
  numberFormat: NumberFormat;
  transactionsEnabled: boolean;
  transfersEnabled: boolean;
  planVisible: boolean;
  hiddenCharts: string[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Ensure the app-side profile row exists before any User-referencing write.
  // In production the `handle_new_user` trigger on auth.users creates this row
  // (see ADR-002 / the supabase_auth_integration migration). But that trigger
  // lives in the Supabase database; when Prisma points at a separate DB (e.g.
  // local Docker Postgres with auth still on Supabase), the row is never
  // created locally and FK constraints fail. This idempotent insert mirrors the
  // trigger as an app-side fallback so sign-in works regardless of which DB
  // Prisma targets. Trigger-first, app-fallback.
  //
  // `createMany({ skipDuplicates })` compiles to INSERT ... ON CONFLICT DO
  // NOTHING — atomic. `upsert` does a non-atomic select-then-insert, so two
  // concurrent first-time requests (a page and its prefetch, or parallel server
  // components) both INSERT and all but one fail with P2002.
  //
  // Both inserts run in ONE transaction so the pair is atomic too: nothing can
  // observe User created but UserSettings not-yet-created, which would make the
  // UserSettings insert trip its userId FK. This matters under the e2e harness,
  // which `TRUNCATE "User" CASCADE`s between tests — a truncate landing between
  // two separate statements (for an in-flight request) would delete the User
  // before UserSettings references it. User first, since UserSettings FKs it.
  await prisma.$transaction([
    prisma.user.createMany({ data: [{ id: user.id }], skipDuplicates: true }),
    prisma.userSettings.createMany({
      data: [{ userId: user.id }],
      skipDuplicates: true,
    }),
  ]);

  const row = await prisma.userSettings.findUniqueOrThrow({
    where: { userId: user.id },
  });
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
  };
}

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
