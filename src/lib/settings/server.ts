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
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

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
  };
}
