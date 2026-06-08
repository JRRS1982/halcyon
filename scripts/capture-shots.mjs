// Capture marketing screenshots from a LOCAL, SEEDED, SIGNED-IN app.
//
// Prerequisites (all local — never against production):
//   1. Local DB seeded with demo data:  make db-seed   (or: pnpm db:seed)
//   2. App running on :3210:            pnpm dev
//   3. A saved signed-in session state at .auth/state.json. To create it once:
//        npx playwright open --save-storage=.auth/state.json http://localhost:3210/sign-in
//      then sign in as the demo user in the opened browser and close it.
//
// Run:  node scripts/capture-shots.mjs
import { chromium } from "playwright";

const BASE = process.env.CAPTURE_BASE_URL ?? "http://localhost:3210";
const shots = [
  { path: "/dashboard", file: "dashboard.png" },
  { path: "/budget", file: "budget.png" },
  { path: "/balance", file: "balance.png" },
  { path: "/transactions", file: "transactions.png" },
];

const browser = await chromium.launch();
const context = await browser.newContext({
  storageState: ".auth/state.json",
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

for (const shot of shots) {
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800); // let charts settle
  await page.screenshot({ path: `public/marketing/${shot.file}` });
  console.log(`captured ${shot.file}`);
}

await browser.close();
