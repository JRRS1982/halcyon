import type { Prisma } from "@prisma/client";
import { cleanLabel } from "@/lib/categories/normalize";

// An account is known by its name in every picker, so two live accounts may
// not share one. Compared ignoring case and spacing, the way a person reads
// them: "Joint Account" and "joint  account" are the same account to the eye.
// Archived accounts do not count — their name is free to reuse — which is also
// why restoring one is checked.

export type AccountNameLookup = {
  findFirst(args: {
    where: Prisma.AccountWhereInput;
    select: { id: true; name: true };
  }): Promise<{ id: string; name: string } | null>;
};

/** The live account already called `name`, other than `exceptId`, if any. */
export function findAccountNamed(
  db: AccountNameLookup,
  userId: string,
  name: string,
  exceptId?: string,
): Promise<{ id: string; name: string } | null> {
  return db.findFirst({
    where: {
      userId,
      deletedAt: null,
      name: { equals: cleanLabel(name), mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true, name: true },
  });
}

export const accountNameTakenError = (name: string) =>
  new Error(`You already have an account called "${name}"`);

/** Throws if a live account other than `exceptId` is already called `name`. */
export async function assertAccountNameFree(
  db: AccountNameLookup,
  userId: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  const taken = await findAccountNamed(db, userId, name, exceptId);
  if (taken) throw accountNameTakenError(taken.name);
}
