// e2e/mobile-plan.spec.ts
//
// The plan page on a phone: the verdict banner's pulled-out figures used to
// sit in one nowrap flex row, and a "needs attention" plan carries three of
// them — the row pushed the whole page sideways and every card looked clipped.
// The charts, whose 140px label gutter leaves almost no plot at 390px, now pan
// inside their card like the timeline and the sheets.
//
// The plan is seeded straight into the DB — the create-plan journey belongs to
// plan.spec.ts, and webkit's phone-sized date input doesn't take fill() —
// so this stays a layout test and runs on every engine.
import type { PrismaClient } from "@prisma/client";
import { expect, signedInUser, signIn, test } from "./_helpers/fixtures";

const PHONE = { width: 390, height: 844 };

// Small pot, spending above income — the projection runs short early, so the
// banner shows all three stats (at retirement / runs out / at age).
async function seedInfeasiblePlan(
  db: PrismaClient,
  userId: string,
): Promise<void> {
  await db.plan.create({
    data: {
      userId,
      dateOfBirth: new Date(Date.UTC(1982, 6, 6)),
      retirementAge: 67,
      statePensionAge: 67,
      statePensionAnnual: 11500,
      assets: {
        create: [
          {
            label: "SIPP",
            wrapper: "PENSION",
            openingValue: 20000,
            minAccessAge: 57,
          },
        ],
      },
      incomes: {
        create: [
          {
            label: "Salary",
            kind: "SALARY",
            annualAmount: 18000,
            endAge: 67,
          },
        ],
      },
      expenses: {
        create: [{ label: "Rent", section: "FIXED", annualAmount: 36000 }],
      },
    },
  });
}

test.describe("Plan on a phone", () => {
  test.use({ viewport: PHONE });

  test("the row editor opens as a bottom sheet and a pull on the grip dismisses it", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);
    await seedInfeasiblePlan(db, user.id);

    await page.goto("/plan");

    // Opening is retried, not clicked once. The row is a server-rendered
    // button, so Playwright judges it actionable — visible, stable, enabled —
    // the moment it paints, which is before React has hydrated the page and
    // attached the handler that opens the sheet. A click in that window is
    // swallowed: nothing happens, and the test then fails on a dialog that was
    // never asked to open. It surfaced on webkit under CI load, where
    // hydration lags furthest behind first paint, and blocked two unrelated
    // PRs before being tracked down.
    //
    // Guarded on visibility so a slow-but-successful open isn't clicked a
    // second time. Same reasoning as signedInUser's poll: the row becomes
    // interactive shortly, not instantly, and saying so is more honest than
    // widening a timeout.
    const dialog = page.getByRole("dialog");
    await expect(async () => {
      if (!(await dialog.isVisible())) {
        await page.getByRole("button", { name: /SIPP/ }).click();
      }
      await expect(dialog).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    // Full width, flush with the bottom edge — a sheet, not a floating card.
    // Polled: toBeVisible fires the moment the slide-up transition starts, so
    // a one-shot measurement on a slow runner catches the sheet mid-slide
    // with residual translateY.
    await expect
      .poll(async () => {
        const b = await dialog.boundingBox();
        return b ? Math.round(b.y + b.height) : -1;
      })
      .toBe(PHONE.height);
    const box = await dialog.boundingBox();
    expect(box?.x).toBeCloseTo(0, 0);
    expect(box?.width).toBeCloseTo(PHONE.width, 0);

    // Pulling the grab strip past the threshold dismisses it.
    const grip = await page.getByTestId("plan-drawer-grip").boundingBox();
    if (!grip) throw new Error("grip not visible");
    const gx = grip.x + grip.width / 2;
    await page.mouse.move(gx, grip.y + 4);
    await page.mouse.down();
    await page.mouse.move(gx, grip.y + 160, { steps: 8 });
    await page.mouse.up();
    await expect(dialog).not.toBeVisible();
  });

  test("an infeasible plan's three verdict figures never push the page sideways", async ({
    page,
    db,
  }) => {
    await signIn(page);
    const user = await signedInUser(db);
    await seedInfeasiblePlan(db, user.id);

    await page.goto("/plan");
    await expect(
      page.getByRole("heading", { name: "Your plan" }),
    ).toBeVisible();
    await expect(page.getByText(/needs attention/i)).toBeVisible();
    await expect(page.getByText(/money runs out/i)).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows, "plan page overflows the viewport").toBe(false);

    // The chart keeps a working width and pans inside its card instead.
    const scroller = page.locator("[data-chart-scroller]");
    await expect(scroller).toBeVisible();
    const { scrollWidth, clientWidth } = await scroller.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);
  });
});
