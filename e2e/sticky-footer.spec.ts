// e2e/sticky-footer.spec.ts
//
// The footer belongs at the bottom of the viewport on a page too short to fill
// it, and at the bottom of the document on one that is taller — the sticky-
// footer flex in globals.css. It broke once already, silently: the (app) layout
// wraps every page in a colour-scheme div, which sits between the flexed body
// and the growing content, so `flex: 1` had no flex parent to grow in and the
// footer rode up under short pages, the auth pages worst of all. Layout only,
// so it runs on every engine.
import { expect, test } from "./_helpers/fixtures";

const SHORT_ROUTES = ["/sign-in", "/sign-up"];

test.describe("The footer on a page shorter than the viewport", () => {
  // Deliberately taller than the auth pages need, so an unpinned footer leaves
  // visible dead space below it rather than merely scrolling out of reach.
  test.use({ viewport: { width: 1280, height: 1400 } });

  for (const path of SHORT_ROUTES) {
    test(`is flush with the bottom of the viewport on ${path}`, async ({
      page,
    }) => {
      await page.goto(path);

      const footer = page.locator("footer");
      await expect(footer).toBeVisible();

      const box = await footer.boundingBox();
      const viewportHeight = page.viewportSize()?.height;
      expect(box, `${path} footer box`).not.toBeNull();

      // The page must not have grown past the viewport — if it has, this is no
      // longer the short-page case and the assertion below proves nothing.
      const scrollHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      expect(scrollHeight, `${path} page height`).toBeLessThanOrEqual(
        (viewportHeight ?? 0) + 1,
      );

      // Any gap here means the content area stopped growing and the footer
      // floated up with it.
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeCloseTo(
        viewportHeight ?? 0,
        0,
      );
    });
  }
});

test.describe("The footer on a page taller than the viewport", () => {
  // Short viewport against the longest public page, so "taller than the
  // viewport" is a fact rather than a hope about how a sheet happened to render.
  test.use({ viewport: { width: 1280, height: 500 } });

  test("ends the document rather than overlaying the content", async ({
    page,
  }) => {
    await page.goto("/guide");

    const footer = page.locator("footer");
    await expect(footer).toBeVisible();

    const { scrollHeight, viewportHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    expect(scrollHeight).toBeGreaterThan(viewportHeight);

    // Pinning short pages must not pin long ones: the footer follows the
    // content down and finishes the document.
    await footer.scrollIntoViewIfNeeded();
    const documentBottom = await footer.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return Math.round(rect.bottom + window.scrollY);
    });
    expect(documentBottom).toBeCloseTo(scrollHeight, -1);
  });
});
