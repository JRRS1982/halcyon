"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { renameAccount as renameAccountShared } from "@/app/(app)/balance/accountActions";
import { buildAccountData } from "@/lib/accounts/creation";
import { cleanLabel } from "@/lib/categories/normalize";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

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
  revalidatePath("/balance");
}

const createSchema = z.object({ name: z.string().trim().min(1).max(120) });

// Every account this form creates is stamped CURRENT_ACCOUNT — the closest
// fit for a bare name-only account, and the same placeholder every other
// type-blind creation path in this PR uses. This whole form is replaced by
// the balance drawer's Add flow (Task 6), which asks for a real type.
export async function createManagedAccount(
  input: z.input<typeof createSchema>,
): Promise<void> {
  const userId = await requireUserId();
  const { name } = createSchema.parse(input);
  await prisma.account.create({
    data: {
      userId,
      name: cleanLabel(name),
      ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
    },
  });
  revalidateAll();
}

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
  const userId = await requireUserId();
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
