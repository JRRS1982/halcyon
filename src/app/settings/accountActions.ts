"use server";

import { cleanLabel } from "@/lib/categories/normalize";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Accounts are managed in Settings and exist independently of the transactions
// feature toggle, so these gate on auth only.
async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/settings");
  return user.id;
}

function revalidateAll() {
  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/budget");
}

const createSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function createManagedAccount(
  input: z.input<typeof createSchema>,
): Promise<void> {
  const userId = await requireUserId();
  const { name } = createSchema.parse(input);
  await prisma.account.create({ data: { userId, name: cleanLabel(name) } });
  revalidateAll();
}

const renameSchema = createSchema.extend({ accountId: z.string().uuid() });

export async function renameAccount(
  input: z.input<typeof renameSchema>,
): Promise<void> {
  const userId = await requireUserId();
  const { accountId, name } = renameSchema.parse(input);
  const result = await prisma.account.updateMany({
    where: { id: accountId, userId, deletedAt: null },
    data: { name: cleanLabel(name) },
  });
  if (result.count === 0) throw new Error("Account not found");
  revalidateAll();
}

const idSchema = z.object({ accountId: z.string().uuid() });

// Soft-delete, but only when the account is unreferenced: it must own no
// transactions and not be named as a transfer counterparty by any transaction.
// The user reassigns/clears those first (mirrors how categories block delete).
export async function deleteAccount(
  input: z.input<typeof idSchema>,
): Promise<void> {
  const userId = await requireUserId();
  const { accountId } = idSchema.parse(input);

  const referenced = await prisma.transaction.count({
    where: {
      userId,
      deletedAt: null,
      OR: [{ accountId }, { transferAccountId: accountId }],
    },
  });
  if (referenced > 0) {
    throw new Error(
      "This account still has transactions. Reassign or remove them first.",
    );
  }

  const result = await prisma.account.updateMany({
    where: { id: accountId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) throw new Error("Account not found");
  revalidateAll();
}
