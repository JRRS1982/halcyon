import {
  addPlanLiability,
  createPlanWithDob,
  expect,
  seedPlanReality,
  signedInUser,
  signIn,
  test,
  withServerAction,
} from "./_helpers/fixtures";

// Phase 3 Task 4: an event's Type can be switched to "Property sale", which
// swaps the manual Direction/Amount fields for a property picker, and the
// Events card row labels the sale with the property instead of an amount.
test("switching an event to Property sale shows the property picker and labels the row", async ({
  page,
  db,
}) => {
  await signIn(page);

  const user = await signedInUser(db);
  await seedPlanReality(db, user.id);

  await page.goto("/plan");
  await createPlanWithDob(page);

  // A mortgage with a new property gives the Events picker something to offer.
  await addPlanLiability(page, {
    name: "Mortgage",
    balance: "0",
    mortgage: true,
    property: "Add a new one",
    propertyLabel: "New property",
  });
  await page.getByRole("button", { name: "Close" }).click();

  // Add an event and switch its type to Property sale.
  const eventsPanel = page.locator("section", { hasText: "One-off events" });
  await withServerAction(page, () =>
    eventsPanel.getByRole("button", { name: /add event/i }).click(),
  );

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^amount$/i)).toBeVisible();

  await withServerAction(page, () =>
    dialog
      .getByRole("combobox", { name: /type/i })
      .selectOption("PROPERTY_SALE"),
  );

  await expect(dialog.getByLabel(/^amount$/i)).not.toBeVisible();
  const propertyPicker = dialog.getByRole("combobox", { name: /property/i });
  await expect(propertyPicker).toBeVisible();
  await withServerAction(page, () =>
    propertyPicker.selectOption({ label: "New property" }),
  );

  await dialog.getByRole("button", { name: "Close" }).click();

  await expect(eventsPanel.getByText(/sale of new property/i)).toBeVisible();
});
