import {
  createPlanWithDob,
  expect,
  seedPlanReality,
  signedInUser,
  signIn,
  test,
  withServerAction,
} from "./_helpers/fixtures";

// Guards withServerAction's retry. A click can land on a server-rendered
// control before React attaches its handler and be swallowed — no action
// dispatches, and the wait fails with "none ever started". That is the failure
// that took plan.spec.ts down on webkit in CI on 27 Aug 2026.
//
// This test exists because deleting the retry breaks nothing else: every other
// spec keeps passing, since they only lose the race under load. Without a
// guard the fix is one refactor away from silently disappearing.
test("withServerAction retries an interaction that dispatched nothing", async ({
  page,
  db,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "harness logic, engine-independent");
  await signIn(page);
  const user = await signedInUser(db);
  await seedPlanReality(db, user.id);
  await page.goto("/plan");
  await createPlanWithDob(page);

  const liabilityPanel = page.locator("section", { hasText: "Liabilities" });

  // Simulate the hydration race deterministically: the first interaction does
  // nothing at all, exactly as a click swallowed by an unhydrated button does.
  // Retrying is safe only because the request listeners attach before the
  // interaction runs — so `seen === 0` proves nothing dispatched, and a retry
  // cannot double-write.
  let calls = 0;
  await withServerAction(page, async () => {
    calls += 1;
    if (calls === 1) return;
    await liabilityPanel
      .getByRole("button", { name: "+ Add mortgage" })
      .click();
  });

  expect(calls).toBeGreaterThan(1);
  await expect(page.getByRole("dialog")).toBeVisible();
});
