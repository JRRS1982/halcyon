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

  // The Add drawer's own button is the server action now — the toolbar button
  // only opens the drawer.
  const panel = page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: "+ Add liability" }) });
  const drawer = page.getByRole("dialog", { name: "Add a liability" });
  await expect(async () => {
    if (!(await drawer.isVisible())) {
      await panel.getByRole("button", { name: "+ Add liability" }).click();
    }
    await expect(drawer).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await drawer.getByLabel("Name").fill("Car loan");
  await drawer.getByLabel("Balance owed today").fill("5000");

  // Simulate the hydration race deterministically: the first interaction does
  // nothing at all, exactly as a click swallowed by an unhydrated button does.
  // Retrying is safe only because the request listeners attach before the
  // interaction runs — so `seen === 0` proves nothing dispatched, and a retry
  // cannot double-write.
  let calls = 0;
  await withServerAction(page, async () => {
    calls += 1;
    if (calls === 1) return;
    await drawer.getByRole("button", { name: "Add", exact: true }).click();
  });

  expect(calls).toBeGreaterThan(1);
  // One row, not two: the retry only fires when nothing dispatched, so it
  // cannot double-write. Counted on the summary rows themselves — the drawer
  // that opens after the add also carries the name.
  await expect(
    panel.getByRole("button", { name: /Car loan/, expanded: undefined }),
  ).toHaveCount(1);
});
