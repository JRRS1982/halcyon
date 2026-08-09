import { prisma } from "@/lib/prisma";
import { getCurrentUserSettings } from "@/lib/settings/server";
import { TEST_USER_ID } from "../../../test/integration/helpers";

describe("getCurrentUserSettings lazy row creation (integration)", () => {
  it("is concurrency-safe: parallel first-time calls don't race the row insert", async () => {
    // beforeEach seeds the user; delete it so every call hits the lazy-create
    // path — i.e. a brand-new user whose User/UserSettings rows don't exist yet
    // (delete cascades to UserSettings).
    await prisma.user.delete({ where: { id: TEST_USER_ID } });

    // Fire many concurrent first-time reads. A select-then-insert upsert races
    // here: several callers find no row, all INSERT, and all but one fail with
    // a P2002 unique-constraint violation. An atomic insert (ON CONFLICT DO
    // NOTHING) must let every caller resolve.
    //
    // These really are 20 calls despite the React `cache()` around the
    // function: cache() memoises within a request scope, and there is no such
    // scope outside a render — so here it passes straight through, which is
    // exactly the concurrency this test is about.
    const results = await Promise.all(
      Array.from({ length: 20 }, () => getCurrentUserSettings()),
    );

    expect(results).toHaveLength(20);
    for (const r of results) expect(r.userId).toBe(TEST_USER_ID);
    expect(await prisma.user.count({ where: { id: TEST_USER_ID } })).toBe(1);
    expect(
      await prisma.userSettings.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(1);
  });
});
