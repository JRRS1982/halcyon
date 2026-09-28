import {
  addPlanLiability,
  createPlanWithDob,
  expect,
  openFresh,
  seedPlanReality,
  signedInUser,
  signIn,
  test,
} from "./_helpers/fixtures";

// Fees / charges % field round-trips: open asset drawer, expand the Growth
// section, set feePct to 0.5, blur → persists after router.refresh().
test("plan: asset fees field round-trips through the drawer", async ({
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

  // Open the seeded asset's drawer (summary row → dialog).
  const assetPanel = page.locator("section", { hasText: "Assets" });
  await assetPanel.getByRole("button", { name: /SIPP/ }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();

  // Expand the Growth section (collapsed by default) to reveal the fee field.
  await drawer.getByRole("button", { name: /growth/i }).click();

  // Fees / charges % round-trips: set 0.5, blur → persists after router.refresh().
  const feeField = drawer.getByLabel(/fees \/ charges %/i);
  await feeField.fill("0.5");
  await feeField.blur();
  await expect(feeField).toHaveValue("0.5");
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
});

// Draggable event markers: a freshly-created plan seeds a "New car" event, so
// the timeline renders a keyboard-operable slider marker. Focus it, nudge the
// age with ArrowRight (live recompute), and confirm the new age persists after
// a full reload (commit-on-keyup → updatePlanEvent → refresh). Keyboard (not a
// synthetic pointer drag) keeps the interaction deterministic.
test("plan: dragging an event marker (keyboard) persists its age", async ({
  page,
  db,
}) => {
  await signIn(page);

  const user = await signedInUser(db);
  await seedPlanReality(db, user.id);

  await page.goto("/plan");
  await createPlanWithDob(page);

  // The seeded "New car" event renders a slider marker on the timeline.
  const marker = page.getByRole("slider", { name: /new car age/i });
  await expect(marker).toBeVisible();
  const before = Number(await marker.getAttribute("aria-valuenow"));

  // Commit-on-keyup persists via a server action (POST to /plan) that only
  // responds after the Prisma write + revalidate complete. Wait for THAT
  // response before reloading — `networkidle` is a racy proxy (it can settle in
  // a quiet window before the async write commits, flaky on WebKit in CI).
  const committed = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" && r.url().includes("/plan") && r.ok(),
  );
  await marker.focus();
  await page.keyboard.press("ArrowRight");
  await expect(marker).toHaveAttribute("aria-valuenow", String(before + 1));

  await committed;
  const fresh = await openFresh(page, "/plan");
  await expect(
    fresh.getByRole("slider", { name: /new car age/i }),
  ).toHaveAttribute("aria-valuenow", String(before + 1));
  await fresh.close();
});

// Draggable bar edges: the seeded Salary income renders start/end grip handles
// on the timeline. Focus its "end" handle, nudge it left (live recompute), and
// confirm the new end age persists after a reload (commit-on-keyup →
// updatePlanIncome → refresh). Keyboard keeps the interaction deterministic.
test("plan: dragging a bar's end handle (keyboard) persists the age", async ({
  page,
  db,
}) => {
  await signIn(page);

  const user = await signedInUser(db);
  await seedPlanReality(db, user.id);

  await page.goto("/plan");
  await createPlanWithDob(page);

  // The seeded Salary income's end handle (salary ends at the retirement age).
  const handle = page.getByRole("slider", { name: /salary end age/i });
  await expect(handle).toBeVisible();
  const before = Number(await handle.getAttribute("aria-valuenow"));

  // Commit-on-keyup persists via a server action (POST to /plan) that only
  // responds after the Prisma write + revalidate complete. Wait for THAT
  // response before reloading — `networkidle` is a racy proxy (it can settle in
  // a quiet window before the async write commits, flaky on WebKit in CI).
  const committed = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" && r.url().includes("/plan") && r.ok(),
  );
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(handle).toHaveAttribute("aria-valuenow", String(before - 1));

  await committed;
  const fresh = await openFresh(page, "/plan");
  await expect(
    fresh.getByRole("slider", { name: /salary end age/i }),
  ).toHaveAttribute("aria-valuenow", String(before - 1));
  await fresh.close();
});

// Phase 2c /plan editing loop, end-to-end through the browser:
// create from seeded data → render chart + verdict + editors → edit an asset
// wrapper and an assumption (save-on-change → revalidate) → and the data-loss
// guard: clearing a required number field must revert, not persist 0.
// CRUD (add/edit/remove) driven through the detail drawer.
test("plan: create, edit assumptions/assets, and the data-loss guard holds", async ({
  page,
  db,
}) => {
  await signIn(page);

  // The landing page after sign-in upserts the public.User row
  // (getCurrentUserSettings). signIn() has already waited for it, so that
  // upsert has settled and /plan's navigation won't race it.

  const user = await signedInUser(db);
  await seedPlanReality(db, user.id);

  // Now navigate to /plan (no plan yet → create form). On submit createPlan
  // syncs the empty plan against the accounts and categories seeded above.
  await page.goto("/plan");
  await createPlanWithDob(page);

  // Plan renders: title, verdict banner, the net-worth chart (svg), and editors.
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Assumptions" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
  // Scoped to recharts' own surface rather than the first <svg> on the page:
  // the nav's hamburger icon is an inline SVG that sits earlier in the DOM and
  // is display:none above the mobile breakpoint, so a bare locator("svg")
  // matches a deliberately hidden element at desktop width.
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  // The seeded SIPP account states wrapper PENSION — nothing is inferred from
  // the label any more — and its legend label reads "Pension" (de-capped).
  await expect(page.locator(".recharts-legend-wrapper")).toContainText(
    "Pension",
  );

  // Open the seeded asset's drawer (summary row → dialog).
  const assetPanel = page.locator("section", { hasText: "Assets" });
  await assetPanel.getByRole("button", { name: /SIPP/ }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();

  // Change the wrapper PENSION → GIA inside the drawer; chart legend recolours.
  const wrapper = drawer.locator("select").first();
  await expect(wrapper).toHaveValue("PENSION");
  await wrapper.selectOption("GIA");
  await expect(page.locator(".recharts-legend-wrapper")).toContainText("GIA");

  // Data-loss guard inside the drawer: clear the required Value, blur → reverts.
  const valueCell = drawer.locator("input[type='number']").first();
  await expect(valueCell).toHaveValue("100000");
  await valueCell.fill("");
  await valueCell.blur();
  await expect(valueCell).toHaveValue("100000");

  // Close the drawer (Escape).
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();

  // Edit an assumption (still inline, save-on-blur → revalidate, page renders).
  const assumptionsPanel = page.locator("section", { hasText: "Assumptions" });
  const retirementAge = assumptionsPanel.getByRole("spinbutton", {
    name: /Retirement age/i,
  });
  await retirementAge.fill("60");
  await retirementAge.blur();
  await expect(retirementAge).toHaveValue("60");
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();

  // Return spread round-trips: set to 3, blur → persists after router.refresh().
  const returnSpread = assumptionsPanel.getByRole("spinbutton", {
    name: /Return spread/i,
  });
  await returnSpread.fill("3");
  await returnSpread.blur();
  await expect(returnSpread).toHaveValue("3");
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();

  // View switcher: Net worth (default) → Cash flow → Liquid assets.
  // Seeded plan has a SALARY income (cash-flow income bar) and a GIA pot
  // (after the wrapper edit above), so each view has a distinctive legend entry.
  await expect(page.getByRole("button", { name: "Net worth" })).toBeVisible();
  // The per-view caption (default = net worth) explains what the chart shows.
  await expect(
    page.getByText(/everything you own minus what you owe/i),
  ).toBeVisible();

  await page.getByRole("button", { name: "Cash flow" }).click();
  await expect(page.locator(".recharts-legend-wrapper")).toContainText(
    "Salary",
  );
  await expect(
    page.getByText(/money in vs money out each year/i),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/plan-2b-cashflow.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Liquid assets" }).click();
  await expect(page.locator(".recharts-legend-wrapper")).toContainText("GIA");
  await expect(page.getByText(/only the pots you can draw on/i)).toBeVisible();
  await page.screenshot({
    path: "test-results/plan-2b-liquid.png",
    fullPage: true,
  });

  // CRUD: add an income → its drawer opens ready to edit; edit the label;
  // confirm-remove closes the drawer.
  const incomePanel = page.locator("section", { hasText: "Income" });
  await incomePanel.getByRole("button", { name: "+ Add income" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const incomeLabel = page
    .getByRole("dialog")
    .locator("input[type='text']")
    .first();
  await expect(incomeLabel).toHaveValue("New income");
  await incomeLabel.fill("Freelance");
  await incomeLabel.blur();
  await expect(incomeLabel).toHaveValue("Freelance");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^remove$/i })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: /yes/i }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // Timeline (read-only Gantt): renders the seeded Salary income row + the
  // retirement reference line. Scope to the Timeline section so "Salary" /
  // "Retirement" don't collide with the income table / assumptions.
  const timeline = page.locator("section", { hasText: "Timeline" });
  await expect(timeline.getByText("Salary")).toBeVisible();
  await expect(timeline.getByText("Retirement")).toBeVisible();

  // A liability added via the add button appears on the timeline too.
  // Wait for the create to answer so the new bar has rendered on the timeline
  // before asserting.
  await addPlanLiability(page, { name: "New liability", balance: "0" });
  await expect(timeline.getByText("New liability")).toBeVisible();

  await page.screenshot({ path: "test-results/plan-1b.png", fullPage: true });
});
