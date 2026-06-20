import { togglePlanVisible } from "@/app/settings/actions";
import { isPlanVisible } from "@/lib/settings/server";
import { TEST_USER_ID } from "../../../test/integration/helpers";

describe("planVisible (integration)", () => {
  it("defaults to true when no settings row exists", async () => {
    expect(await isPlanVisible(TEST_USER_ID)).toBe(true);
  });
  it("togglePlanVisible(false) hides it; (true) shows it", async () => {
    await togglePlanVisible(false);
    expect(await isPlanVisible(TEST_USER_ID)).toBe(false);
    await togglePlanVisible(true);
    expect(await isPlanVisible(TEST_USER_ID)).toBe(true);
  });
});
