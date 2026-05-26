"use server";

import { prisma } from "@/lib/prisma";
import { CURRENCY_CODES } from "@/lib/settings/currency";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const updateSettingsSchema = z.object({
  currency: z.enum(CURRENCY_CODES),
});

export async function updateSettings(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/settings");

  const parsed = updateSettingsSchema.parse({
    currency: formData.get("currency"),
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { currency: parsed.currency },
    create: { userId: user.id, currency: parsed.currency },
  });

  // Currency is read by server components on /budget; invalidate so the
  // formatter picks up the new value on next render.
  revalidatePath("/budget");
  revalidatePath("/settings");
}
