// e2e/not-found.spec.ts
import { expect, test } from "@playwright/test";

test.describe("Unknown routes", () => {
  test("render the app's 404 rather than a bare Next error page", async ({
    page,
  }) => {
    const response = await page.goto("/this-route-does-not-exist");

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: /that page doesn't exist/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /go to dashboard/i }),
    ).toBeVisible();
  });
});
