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
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { currency: parsed.currency, numberFormat: parsed.numberFormat },
    create: {
      userId: user.id,
      currency: parsed.currency,
      numberFormat: parsed.numberFormat,
    },
  });

  // Currency + number format are read by /budget and /balance server
  // components; invalidate so the formatters pick up the new values.
  revalidatePath("/budget");
  revalidatePath("/balance");
  revalidatePath("/settings");
}
