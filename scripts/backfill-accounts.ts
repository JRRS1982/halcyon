import { backfillAccountsForUser } from "../src/lib/accounts/backfill";
import { prisma } from "../src/lib/prisma";

// Run explicitly rather than as a migration side effect: this rewrites live
// data and the operator should choose when it happens. Idempotent, so running
// it twice is harmless.
async function main() {
  const users = await prisma.user.findMany({ select: { id: true } });
  let accounts = 0;
  let items = 0;

  for (const user of users) {
    // Logged before the call, not just after: if this user's backfill throws,
    // the operator can see exactly which user it happened to and that every
    // user logged before it already committed.
    console.log(`${user.id}: starting`);
    const result = await backfillAccountsForUser(user.id);
    accounts += result.accountsCreated;
    items += result.itemsLinked;
    console.log(
      `${user.id}: ${result.accountsCreated} accounts created, ${result.itemsLinked} rows linked`,
    );
  }

  console.log(
    `\nDone. ${accounts} accounts created, ${items} balance rows linked.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
