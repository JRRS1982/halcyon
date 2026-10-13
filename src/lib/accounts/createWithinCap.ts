import type { Account, Prisma } from "@prisma/client";
import { assertRoom } from "@/lib/limits/ceilings";
import { accountLimitError, MAX_ACCOUNTS_PER_USER } from "./limits";

// The only place in the app that creates an Account. See the header on
// categories/createWithinCap.ts for why this is a function rather than a
// convention — there were four create sites and two of them checked the cap,
// both inside the same transaction, so the import paths created accounts with
// no ceiling at all.
export type AccountDelegate = {
  // deletedAt optional so the same delegate serves both counts: omitted means
  // every row, including tombstones.
  count(args: { where: { userId: string; deletedAt?: null } }): Promise<number>;
  create(args: { data: Prisma.AccountUncheckedCreateInput }): Promise<Account>;
};

export async function createAccountWithinCap(
  db: AccountDelegate,
  data: Prisma.AccountUncheckedCreateInput,
): Promise<Account> {
  // Two ceilings. Archiving is a soft delete and an archived account is still
  // read back on the months it recorded a value, so a tombstone must not
  // consume one of the user's slots — and that is precisely why the live count
  // cannot also be the storage bound. See lib/limits/ceilings.ts.
  await assertRoom({
    countLive: () =>
      db.count({ where: { userId: data.userId, deletedAt: null } }),
    countStored: () => db.count({ where: { userId: data.userId } }),
    liveMax: MAX_ACCOUNTS_PER_USER,
    liveError: accountLimitError,
  });

  return db.create({ data });
}
