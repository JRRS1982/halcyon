import "server-only";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  type CurrencyCode,
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
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Ensure the app-side profile row exists before any User-referencing write.
  // In production the `handle_new_user` trigger on auth.users creates this row
  // (see ADR-002 / the supabase_auth_integration migration). But that trigger
  // lives in the Supabase database; when Prisma points at a separate DB (e.g.
  // local Docker Postgres with auth still on Supabase), the row is never
  // created locally and FK constraints fail. This idempotent upsert mirrors the
  // trigger as an app-side fallback so sign-in works regardless of which DB
  // Prisma targets. Trigger-first, app-fallback.
  await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: { id: user.id },
  });

  const row = await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  return {
    userId: user.id,
    currency: isCurrencyCode(row.currency) ? row.currency : "USD",
    numberFormat: isNumberFormat(row.numberFormat)
      ? row.numberFormat
      : DEFAULT_NUMBER_FORMAT,
    transactionsEnabled: row.transactionsEnabled,
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
