import {
  expect,
  signIn,
  signedInUser,
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
  const start = new Date(Date.UTC(2026, 0, 1));
  const end = new Date(Date.UTC(2026, 0, 31));
  await db.financialPeriod.create({
    data: {
      userId: user.id,
      granularity: "MONTH",
      startDate: start,
      endDate: end,
      label: "Jan 2026",
      balanceItems: {
        create: [
          {
            type: "ASSET",
            category: "LONG_TERM",
            label: "SIPP",
            value: 100000,
          },
        ],
      },
      items: {
        create: [
          {
            type: "INCOME",
            incomeCategory: "SALARY",
            label: "Salary",
            budget: 4000,
          },
        ],
      },
    },
  });

  await page.goto("/plan");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='date']").fill("1986-06-01");
  await page.getByRole("button", { name: /create my plan/i }).click();

  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();

  // Add a property (via "Add mortgage", which creates the property + mortgage
  // + repayment trio) so the Events picker has something to offer.
  const liabilityPanel = page.locator("section", { hasText: "Liabilities" });
  await withServerAction(page, () =>
    liabilityPanel.getByRole("button", { name: "+ Add mortgage" }).click(),
  );
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
