import { chromium } from "@playwright/test";

// Captures the front page's and feature pages' picture plates: one section of
// each app screen, at 2x, from the seeded demo account on a LOCAL dev server.
//
//   make db-seed           # the demo account: twelve months ending this one
//   make up                # or: pnpm dev (serves :3210)
//   node scripts/capture-shots.mjs
//
// Each plate is a whole section, edge to edge with a 20px margin and nothing
// sliced at the top or bottom: a plate cut through a row reads as a broken
// page. The budget and balance are shot on the last COMPLETE month, because
// the current one is still filling in. The alt text in
// src/lib/editorial/features.ts quotes that month's figures, so re-read it
// after a re-shoot, and update each plate's `aspect` there (and in
// Hero/index.tsx for budget-lead) to the new pixel sizes this prints.

const BASE = process.env.CAPTURE_BASE_URL ?? "http://localhost:3210";
const EMAIL = process.env.CAPTURE_EMAIL ?? "demo@halcyon.local";
const PASSWORD = process.env.CAPTURE_PASSWORD ?? "halcyon-demo";
const OUT = "public/marketing/plates/";

// The demo password is published in this repo; it must only ever be typed
// into a local app.
if (!["localhost", "127.0.0.1"].includes(new URL(BASE).hostname)) {
  throw new Error(`Refusing to sign in to a non-local app: ${BASE}`);
}

const now = new Date();
const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const ym = `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}`;

// Every plate is shot twice, light then dark. The front page shows the one
// that matches the page around it.
let scheme = "light";
const plate = (file) =>
  OUT + (scheme === "dark" ? file.replace(/\.png$/, "-dark.png") : file);

async function open(page, path) {
  await page.goto(BASE + path);
  // The dev overlay's badge would otherwise appear in the corner of a plate.
  await page.addStyleTag({ content: "nextjs-portal{display:none}" });
  // The OS setting covers an account left on System; the attribute overrides
  // an account (like the demo) that pinned a scheme. Every colour is a CSS
  // variable keyed on these two, charts included, so nothing needs a reload.
  await page.emulateMedia({ colorScheme: scheme });
  await page.evaluate((s) => {
    for (const el of document.querySelectorAll("[data-theme]")) {
      el.setAttribute("data-theme", s);
    }
  }, scheme);
  await page.waitForTimeout(2500);
}

/** Shoots from the top of `from` to the bottom of `to`, across the main column. */
async function shoot(page, file, from, to, { top = 40, bottom = 2 } = {}) {
  const h1 = await page.locator("main h1").first().boundingBox();
  const main = await page.locator("main").first().boundingBox();
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  const left = h1.x - 20;
  const right = main.x + main.width - (h1.x - main.x) + 20;
  await page.screenshot({
    path: plate(file),
    clip: {
      x: left,
      y: a.y - top,
      width: right - left,
      height: b.y + b.height - a.y + top + bottom,
    },
  });
  console.log("plate", file);
}

const browser = await chromium.launch();
const desk = await browser.newContext({
  viewport: { width: 1280, height: 2600 },
  deviceScaleFactor: 2,
});
const page = await desk.newPage();
await page.goto(`${BASE}/sign-in`);
await page.fill("input[name='email']", EMAIL);
await page.fill("input[name='password']", PASSWORD);
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL(/transactions|dashboard/, { timeout: 120_000 });

for (scheme of ["light", "dark"]) {
  // Anchored at the start, not exact: a row's "i" button adds its own words to
  // the header's accessible name ("Fixed What goes in Fixed?").
  const rowheader = (name) =>
    page.getByRole("rowheader", { name: new RegExp(`^${name}`) }).first();

  await open(page, `/budget?ym=${ym}`);
  // Through the whole of Income to the head of Expenses: the sheet reads as a sheet.
  await shoot(
    page,
    "budget-lead.png",
    page.locator("main h1").first(),
    rowheader("Fixed"),
  );
  // The three expense sections: from just inside the Expenses row (clear of the
  // rule above it) to the top of Debt payments, so it ends on the last line.
  {
    const h1 = await page.locator("main h1").first().boundingBox();
    const main = await page.locator("main").first().boundingBox();
    const from = await rowheader("Expenses").boundingBox();
    const to = await rowheader("Debt payments").boundingBox();
    const left = h1.x - 20;
    const right = main.x + main.width - (h1.x - main.x) + 20;
    await page.screenshot({
      path: plate("budget-share.png"),
      clip: {
        x: left,
        y: from.y + 2,
        width: right - left,
        height: to.y - from.y - 4,
      },
    });
    console.log("plate budget-share.png");
  }

  await open(page, `/balance?ym=${ym}`);
  // Every asset, down to the Liabilities heading.
  await shoot(
    page,
    "balance.png",
    page.locator("main h1").first(),
    rowheader("Liabilities"),
  );

  await open(page, "/transactions");
  await shoot(
    page,
    "transactions.png",
    page.locator("main h1").first(),
    page.locator("tbody tr").nth(9),
  );

  await open(page, "/plan");
  // The forecast itself: the view tabs, the caption and the projection chart.
  await shoot(
    page,
    "plan.png",
    page.getByRole("group", { name: "Chart view" }),
    page.locator("[data-chart-scroller]"),
    { top: 20, bottom: 16 },
  );

  await open(page, "/dashboard");
  // Just the cash-flow chart; the front page sets its own heading over it.
  const cashflow = page
    .locator("section", {
      has: page.getByRole("heading", { name: "Income vs expenses" }),
    })
    .locator(".recharts-responsive-container")
    .first();
  await shoot(page, "cashflow.png", cashflow, cashflow, { top: 8, bottom: 8 });

  await open(page, "/settings");
  // The demo account pins Light; the dark plate should read Dark. Set on the
  // element only, with no change event, so nothing is saved.
  await page.evaluate((s) => {
    for (const select of document.querySelectorAll("select")) {
      const option = [...select.options].find(
        (o) => o.value === s.toUpperCase(),
      );
      if (option) select.value = option.value;
    }
  }, scheme);
  // The narrow settings column, from Format to the transactions switches.
  const format = page.getByRole("heading", { name: "Format" });
  const toggles = page.getByRole("heading", { name: "Transactions" }).first();
  const col = await format.boundingBox();
  const end = await toggles.boundingBox();
  await page.screenshot({
    path: plate("settings.png"),
    clip: {
      x: col.x - 20,
      y: col.y - 24,
      width: col.width + 40,
      height: end.y - col.y + 360,
    },
  });
  console.log("plate settings.png");

  // The phone lead: the budget as a phone renders it, headline to month in brief.
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    storageState: await desk.storageState(),
  });
  const m = await phone.newPage();
  await open(m, `/budget?ym=${ym}`);
  const mm = await m.locator("main").first().boundingBox();
  const mh1 = await m.locator("main h1").first().boundingBox();
  const brief = await m
    .locator('[aria-label="The month in brief"]')
    .boundingBox();
  await m.screenshot({
    path: plate("budget-lead-phone.png"),
    clip: {
      x: mm.x,
      y: mh1.y - 40,
      width: mm.width,
      height: brief.y + brief.height - mh1.y + 48,
    },
  });
  console.log("plate budget-lead-phone.png");

  // The story plates as a phone renders each screen: one short, legible section,
  // across the full width of the phone's main column.
  // Sections sit below the phone's fold, so this shoots the full page, measured
  // from the top (scrolled to 0, a bounding box is a page coordinate).
  async function shootPhone(file, from, to, { top = 0, bottom = 0 } = {}) {
    await m.evaluate(() => window.scrollTo(0, 0));
    const col = await m.locator("main").first().boundingBox();
    const a = await from.boundingBox();
    const b = await to.boundingBox();
    await m.screenshot({
      path: plate(file),
      fullPage: true,
      clip: {
        x: col.x,
        y: a.y - top,
        width: col.width,
        height: b.y + b.height - a.y + top + bottom,
      },
    });
    console.log("plate", file);
  }
  const phoneRow = (name) =>
    m.getByRole("rowheader", { name: new RegExp(`^${name}`) }).first();

  // Expenses through Fixed to the first Variable line.
  await shootPhone(
    "budget-share-phone.png",
    phoneRow("Expenses"),
    phoneRow("Groceries"),
    { bottom: 2 },
  );

  await open(m, `/balance?ym=${ym}`);
  // The headline and its brief: what moved, legible at a glance.
  await shootPhone(
    "balance-phone.png",
    m.locator("main h1").first(),
    m.locator('[aria-label="The month in brief"]').first(),
    { top: 40, bottom: 12 },
  );

  await open(m, "/transactions");
  // The first three ledger lines: suggested categories in pencil, Approve beside.
  await shootPhone(
    "transactions-phone.png",
    m.locator("tbody tr").nth(0),
    m.locator("tbody tr").nth(2),
    { top: 8, bottom: 2 },
  );

  await open(m, "/plan");
  // The verdict: whether the money lasts, and the figures behind it.
  const verdict = m.locator("main section").first();
  await shootPhone("plan-phone.png", verdict, verdict, { top: 8, bottom: 8 });

  await open(m, "/dashboard");
  const phoneCashflow = m
    .locator("section", {
      has: m.getByRole("heading", { name: "Income vs expenses" }),
    })
    .first();
  await shootPhone("cashflow-phone.png", phoneCashflow, phoneCashflow, {
    top: 8,
    bottom: 8,
  });
}

await browser.close();
