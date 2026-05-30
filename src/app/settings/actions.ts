"use server";

import { prisma } from "@/lib/prisma";
import { CURRENCY_CODES, NUMBER_FORMATS } from "@/lib/settings/currency";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const updateSettingsSchema = z.object({
  currency: z.enum(CURRENCY_CODES),
  numberFormat: z.enum(NUMBER_FORMATS),
  // Unchecked checkboxes are absent from FormData; a checked one submits "on".
  transactionsEnabled: z.boolean(),
});

export async function updateSettings(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/settings");

  const parsed = updateSettingsSchema.parse({
    currency: formData.get("currency"),
    numberFormat: formData.get("numberFormat"),
    transactionsEnabled: formData.get("transactionsEnabled") === "on",
  });

  const values = {
    currency: parsed.currency,
    numberFormat: parsed.numberFormat,
    transactionsEnabled: parsed.transactionsEnabled,
  };
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: values,
    create: { userId: user.id, ...values },
  });

  // Currency + number format are read by /budget and /balance server
  // components; the transactions toggle changes the nav + route gating, which
  // the root layout renders. Invalidate broadly so all pick up the new values.
  revalidatePath("/", "layout");
}
