"use server";

import { isDashboardChartKey } from "@/lib/dashboard/charts";
import { prisma } from "@/lib/prisma";
import { CURRENCY_CODES, NUMBER_FORMATS } from "@/lib/settings/currency";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
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

const setChartVisibilitySchema = z.object({
  key: z.string(),
  visible: z.boolean(),
});

// Shows/hides a single dashboard chart group for the user by adding/removing
// its key from UserSettings.hiddenCharts.
export async function setChartVisibility(
  input: z.input<typeof setChartVisibilitySchema>,
) {
  const userId = await requireUserId();
  const { key, visible } = setChartVisibilitySchema.parse(input);
  if (!isDashboardChartKey(key)) throw new Error("Unknown chart");

  const row = await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { hiddenCharts: true },
  });
  const hidden = new Set(row.hiddenCharts);
  if (visible) hidden.delete(key);
  else hidden.add(key);

  await prisma.userSettings.update({
    where: { userId },
    data: { hiddenCharts: Array.from(hidden) },
  });
  revalidatePath("/dashboard");
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

// Flips the budget Transfers section on/off. Only affects the budget page's
// rendering and the ledger's Transfer option, so revalidate those.
export async function toggleTransfers(enabled: boolean) {
  const userId = await requireUserId();
  await prisma.userSettings.upsert({
    where: { userId },
    update: { transfersEnabled: enabled },
    create: { userId, transfersEnabled: enabled },
  });
  revalidatePath("/budget");
  revalidatePath("/transactions");
  revalidatePath("/settings");
}
