"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { renameAccount as renameAccountShared } from "@/app/(app)/balance/accountActions";
import { requireUserId } from "@/lib/auth/requireUserId";
import { prisma } from "@/lib/prisma";

// Accounts are managed in Settings and exist independently of the transactions
// feature toggle, so these gate on auth only. Deleting goes through the balance
// sheet's deleteAccountEverywhere/archiveAccount, from the same panel.

// One implementation, shared with the balance sheet's own rename entry point
// (src/app/(app)/balance/accountActions.ts) — it also propagates the name
// into every live budget/balance row's label mirror, which this form needs
// exactly as much as that one does.
export const renameAccount = renameAccountShared;

const idSchema = z.object({ accountId: z.string().uuid() });

const importsSchema = idSchema.extend({ enabled: z.boolean() });

// Changeable after creation, per the design spec — the drawer and the backfill
// both only ever write this at creation time, which left no way to turn
// imports on for e.g. a mortgage account the backfill created as false.
export async function setAccountImports(
  input: z.input<typeof importsSchema>,
): Promise<void> {
  const userId = await requireUserId("/settings");
  const { accountId, enabled } = importsSchema.parse(input);
  const result = await prisma.account.updateMany({
    where: { id: accountId, userId, deletedAt: null },
    data: { canImportTransactions: enabled },
  });
  if (result.count === 0) throw new Error("Account not found");
  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/balance");
}
