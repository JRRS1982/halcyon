import type { Account, Prisma } from "@prisma/client";
import { accountLimitError, MAX_ACCOUNTS_PER_USER } from "./limits";

// The only place in the app that creates an Account. See the header on
// categories/createWithinCap.ts for why this is a function rather than a
// convention — there were four create sites and two of them checked the cap,
// both inside the same transaction, so the import paths created accounts with
// no ceiling at all.
export type AccountDelegate = {
  count(args: { where: { userId: string; deletedAt: null } }): Promise<number>;
  create(args: { data: Prisma.AccountUncheckedCreateInput }): Promise<Account>;
};

export async function createAccountWithinCap(
  db: AccountDelegate,
  data: Prisma.AccountUncheckedCreateInput,
): Promise<Account> {
  // Live rows only: archiving is a soft delete and an archived account is
  // still read back on the months it recorded a value, so a tombstone must
  // not consume one of the user's slots.
  const held = await db.count({
    where: { userId: data.userId, deletedAt: null },
  });
  if (held >= MAX_ACCOUNTS_PER_USER) throw accountLimitError();

  return db.create({ data });
}
