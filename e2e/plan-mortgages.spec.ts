import {
  addPlanLiability,
  createPlanWithDob,
  expect,
  openFresh,
  seedPlanReality,
  signedInUser,
  signIn,
  test,
  withServerAction,
} from "./_helpers/fixtures";

// Phase 1 first-class mortgages: a mortgage liability creates a property
// + repayment trio and opens the shared property card (not the plain
// liability drawer) — the routing PlanView derives from linkedAssetId.
test("add a mortgage opens the property card with a mortgage section", async ({
  page,
  db,
}) => {
  await signIn(page);

  const user = await signedInUser(db);
  await seedPlanReality(db, user.id);

  await page.goto("/plan");
  // Wait for hydration: the "Create my plan" button stays disabled until the
  // date field's onChange sets state, which needs the client bundle attached.
  await createPlanWithDob(page);

  // A mortgage is a liability that names the property it is secured on; the
  // Add drawer creates both, and opens the shared property card.
  await addPlanLiability(page, {
    name: "Mortgage",
    balance: "0",
    mortgage: true,
    property: "Add a new one",
    propertyLabel: "New property",
  });

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Eyebrow reads "Property" (exact — the "Mortgage"/"Property" section
  // headers below append a +/− disclosure glyph, so an exact match keeps
  // this from also matching them under Playwright's strict mode).
  await expect(dialog.getByText("Property", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /^mortgage/i }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /remove mortgage/i }),
  ).toBeVisible();
});

// Phase 2 Task 5: the interest-only toggle persists (updatePlanLiability) and
// hides the editable monthly repayment once the mortgage is interest-only.
test("toggling interest-only persists after reload and hides the repayment field", async ({
  page,
  db,
}) => {
  await signIn(page);

  const user = await signedInUser(db);
  await seedPlanReality(db, user.id);

  await page.goto("/plan");
  await createPlanWithDob(page);

  const liabilityPanel = page.locator("section", { hasText: "Liabilities" });
  await addPlanLiability(page, {
    name: "Mortgage",
    balance: "0",
    mortgage: true,
    property: "Add a new one",
    propertyLabel: "New property",
  });

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/repayment \/mo/i)).toBeVisible();

  const interestOnly = dialog.getByRole("checkbox", {
    name: /interest-only/i,
  });
  await expect(interestOnly).not.toBeChecked();
  // Commit-on-change persists via updatePlanLiability; wait for that write to
  // answer rather than for the checkbox, which flips optimistically.
  await withServerAction(page, () => interestOnly.click());
  await expect(interestOnly).toBeChecked();
  await expect(dialog.getByLabel(/repayment \/mo/i)).not.toBeVisible();

  // A fresh tab rather than page.reload(): the commit is followed by
  // router.refresh(), and reloading into that navigation is what firefox
  // reports as NS_BINDING_ABORTED (see openFresh). The write has already
  // answered, so what loads here is the persisted state.
  const fresh = await openFresh(page, "/plan");

  // Reopen the property card via its Assets row ("New property" is the
  // default label createPlanProperty assigns).
  const assetsPanel = fresh.locator("section", { hasText: "Assets" });
  await assetsPanel.getByRole("button", { name: /new property/i }).click();

  const reopened = fresh.getByRole("dialog");
  await expect(reopened).toBeVisible();
  await expect(
    reopened.getByRole("checkbox", { name: /interest-only/i }),
  ).toBeChecked();
  await expect(reopened.getByLabel(/repayment \/mo/i)).not.toBeVisible();
  await fresh.close();
});
