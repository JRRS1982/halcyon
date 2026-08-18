// e2e/mobile-import.spec.ts
//
// The CSV import dialog on a phone. The dialog is a CSS grid, and without
// minmax(0, …) clamps its children's intrinsic widths (the preview table's
// nowrap rows, the two-column mapping grid) stretched the track past the
// dialog's edge — the right half of the mapping step was simply cut off a
// 390px screen. Layout-only and no server writes (the mapping step is all
// client-side parsing), so it runs ungated on every engine.
import { expect, importCsv, signIn, test } from "./_helpers/fixtures";

const PHONE = { width: 390, height: 844 };

test.describe("Import on a phone", () => {
  test.use({ viewport: PHONE });

  test("the mapping step fits the dialog and both actions stay reachable", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/transactions");

    const csv = [
      "Date,Description,Amount,Balance,Reference",
      "05/08/2026,TESCO STORES 3412 LONDON GB,-42.50,1200.00,POS-0001",
      "06/08/2026,COSTA COFFEE 118 LONDON,-4.85,1195.15,POS-0002",
      "07/08/2026,ACME PAYROLL LTD SALARY,2500.00,3695.15,BACS-991",
    ].join("\n");
    await importCsv(page, csv);

    // Nothing inside the dialog sticks out past its horizontal edge — the
    // failure mode was children stretching the grid track and being clipped.
    const dialog = page.locator("dialog", { hasText: "Import a statement" });
    await expect(dialog).toBeVisible();
    const fits = await dialog.evaluate(
      (el) => el.scrollWidth <= el.clientWidth,
    );
    expect(fits, "dialog content wider than the dialog").toBe(true);

    // Both actions sit inside the viewport (the long primary label used to
    // shove Cancel off the edge).
    for (const name of [/^cancel$/i, /^import 3 transactions/i]) {
      const box = await dialog.getByRole("button", { name }).boundingBox();
      expect(box, `button ${name} not visible`).not.toBeNull();
      if (!box) continue;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width + 1);
    }
  });
});
