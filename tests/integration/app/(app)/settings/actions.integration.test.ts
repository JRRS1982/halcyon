import { TEST_USER_ID } from "@test/support/helpers";
import {
  setChartVisibility,
  setMonthlyReminderDay,
  setThemePreference,
  toggleMonthlyReminder,
  toggleTransfers,
  updateSettings,
} from "@/app/(app)/settings/actions";
import { prisma } from "@/lib/prisma";

const settings = () =>
  prisma.userSettings.findUniqueOrThrow({ where: { userId: TEST_USER_ID } });

const formatForm = (currency: string, numberFormat: string) => {
  const form = new FormData();
  form.set("currency", currency);
  form.set("numberFormat", numberFormat);
  return form;
};

// The Settings page's preferences. Every one of these is read back by another
// page — the sheets format with the currency, the dashboard skips hidden
// charts, the cron reads the reminder — so what matters is what is stored.
describe("settings actions (integration)", () => {
  describe("format preferences", () => {
    // If wrong, the budget and balance sheets render in the old currency.
    test("saves the currency and number format", async () => {
      await updateSettings(formatForm("EUR", "DOT_2"));

      await expect(settings()).resolves.toMatchObject({
        currency: "EUR",
        numberFormat: "DOT_2",
      });
    });

    test("refuses a currency the app cannot render, storing nothing", async () => {
      await expect(
        updateSettings(formatForm("XXX", "DOT_2")),
      ).rejects.toThrow();

      await expect(settings()).resolves.toMatchObject({
        currency: "GBP",
        numberFormat: "COMMA_0",
      });
    });
  });

  describe("dashboard chart visibility", () => {
    test("hides a chart, then shows it again", async () => {
      await setChartVisibility({ key: "cashFlow", visible: false });
      expect((await settings()).hiddenCharts).toEqual(["cashFlow"]);

      await setChartVisibility({ key: "cashFlow", visible: true });
      expect((await settings()).hiddenCharts).toEqual([]);
    });

    // A double click must not leave a duplicate that one "show" can't clear.
    test("hiding a chart twice records it once", async () => {
      await setChartVisibility({ key: "balanceTrend", visible: false });
      await setChartVisibility({ key: "balanceTrend", visible: false });

      expect((await settings()).hiddenCharts).toEqual(["balanceTrend"]);
    });

    test("refuses a chart the dashboard does not have", async () => {
      await expect(
        setChartVisibility({ key: "notAChart", visible: false }),
      ).rejects.toThrow("Unknown chart");
      expect((await settings()).hiddenCharts).toEqual([]);
    });
  });

  test("turns the budget's transfers section off", async () => {
    await toggleTransfers(false);

    expect((await settings()).transfersEnabled).toBe(false);
  });

  describe("theme", () => {
    test("saves a known theme", async () => {
      await setThemePreference("DARK");

      expect((await settings()).themePreference).toBe("DARK");
    });

    test("ignores a theme the app does not offer", async () => {
      await setThemePreference("PURPLE");

      expect((await settings()).themePreference).toBe("SYSTEM");
    });
  });

  describe("monthly reminder", () => {
    // The cron skips a subscriber with no token rather than send mail nobody
    // can unsubscribe from, so turning it on without one is a silent no-op.
    test("turning it on also mints the unsubscribe token", async () => {
      await toggleMonthlyReminder(true);

      const row = await settings();
      expect(row.monthlyReminderEnabled).toBe(true);
      expect(row.unsubscribeToken).toEqual(expect.any(String));
    });

    // A token already sitting in sent emails must keep working.
    test("turning it back on keeps the existing token", async () => {
      await toggleMonthlyReminder(true);
      const { unsubscribeToken } = await settings();

      await toggleMonthlyReminder(false);
      await toggleMonthlyReminder(true);

      expect((await settings()).unsubscribeToken).toBe(unsubscribeToken);
    });

    test("saves an offered reminder day and ignores any other", async () => {
      await setMonthlyReminderDay(15);
      expect((await settings()).monthlyReminderDay).toBe(15);

      await setMonthlyReminderDay(31);
      expect((await settings()).monthlyReminderDay).toBe(15);
    });
  });
});
