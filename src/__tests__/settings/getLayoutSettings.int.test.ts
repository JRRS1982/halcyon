import { prisma } from "@/lib/prisma";
import { getLayoutSettings } from "@/lib/settings/server";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// The nav is rendered from getLayoutSettings, and the pages beside it read
// through getCurrentUserSettings, which provisions the settings row. When the
// layout's read did not provision, it answered `transactionsEnabled: false`
// for anyone whose row did not exist yet — so a brand-new user's first
// authenticated page rendered a nav with no Transactions link while the page
// itself worked fine, and afterwards the nav was wrong whenever a render
// observed the row before that insert had committed.

async function asBrandNewUser(): Promise<void> {
  // beforeEach seeds the user; deleting it cascades to UserSettings, which is
  // the state a first-ever authenticated request actually starts from.
  await prisma.user.delete({ where: { id: TEST_USER_ID } });
}

describe("getLayoutSettings (integration)", () => {
  it("gives a brand-new user the real defaults, not a nav with everything off", async () => {
    await asBrandNewUser();

    const settings = await getLayoutSettings(TEST_USER_ID);

    // Defaults true in the schema. Reading it as false is what dropped
    // the Transactions link out of the nav.
    expect(settings.transactionsEnabled).toBe(true);
  });

  it("provisions the row, so the very next read agrees with it", async () => {
    await asBrandNewUser();

    const first = await getLayoutSettings(TEST_USER_ID);
    const row = await prisma.userSettings.findUnique({
      where: { userId: TEST_USER_ID },
    });
    expect(row).not.toBeNull();

    const second = await getLayoutSettings(TEST_USER_ID);
    expect(second).toEqual(first);
  });

  it("reports a stored preference rather than the default", async () => {
    await prisma.userSettings.update({
      where: { userId: TEST_USER_ID },
      data: { transactionsEnabled: false },
    });

    const settings = await getLayoutSettings(TEST_USER_ID);
    expect(settings.transactionsEnabled).toBe(false);
  });

  it("treats a signed-out visitor as having nothing enabled", async () => {
    const settings = await getLayoutSettings(undefined);
    expect(settings.transactionsEnabled).toBe(false);
  });
});
