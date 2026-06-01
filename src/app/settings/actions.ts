"use server";

import { prisma } from "@/lib/prisma";
import { CURRENCY_CODES, NUMBER_FORMATS } from "@/lib/settings/currency";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/settings");
  return user.id;
}

const updateSettingsSchema = z.object({
  currency: z.enum(CURRENCY_CODES),
  numberFormat: z.enum(NUMBER_FORMATS),
});

// Saves the Format preferences (currency + number format) from the Save button.
// The transactions toggle is handled separately (toggleTransactions).
export async function updateSettings(formData: FormData) {
  const userId = await requireUserId();
  const parsed = updateSettingsSchema.parse({
    currency: formData.get("currency"),
    numberFormat: formData.get("numberFormat"),
  });

  await prisma.userSettings.upsert({
    where: { userId },
    update: parsed,
    create: { userId, ...parsed },
  });

  // Read by /budget and /balance server components for formatting.
  revalidatePath("/budget");
  revalidatePath("/balance");
  revalidatePath("/settings");
}

// Flips the transactions feature on/off. Called from the toggle's own confirm
// dialog (not the Save button). Changes the nav + route gating + budget
// actuals, all rendered server-side, so revalidate the whole layout.
export async function toggleTransactions(enabled: boolean) {
  const userId = await requireUserId();
  await prisma.userSettings.upsert({
    where: { userId },
    update: { transactionsEnabled: enabled },
    create: { userId, transactionsEnabled: enabled },
  });
  revalidatePath("/", "layout");
}
