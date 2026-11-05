import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Turns a `lhci collect` run into one shields.io endpoint file per Lighthouse
// category: the median score of the runs, coloured the way Lighthouse colours
// it (90+ green, 50+ orange, below that red). The README's badges read these
// files from the `badges` branch.
//
//   node scripts/lighthouse-badges.mjs <lhci dir> <out dir>

const [source = ".lighthouseci", out = "badges"] = process.argv.slice(2);

const LABELS = {
  performance: "performance",
  accessibility: "accessibility",
  "best-practices": "best practices",
  seo: "SEO",
};

const runs = readdirSync(source)
  .filter((name) => name.startsWith("lhr-") && name.endsWith(".json"))
  .map((name) => JSON.parse(readFileSync(join(source, name), "utf8")));

if (runs.length === 0) throw new Error(`No Lighthouse runs in ${source}`);

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const colour = (score) =>
  score >= 90 ? "brightgreen" : score >= 50 ? "orange" : "red";

for (const [id, label] of Object.entries(LABELS)) {
  const score = Math.round(
    median(runs.map((run) => run.categories[id].score)) * 100,
  );
  const badge = {
    schemaVersion: 1,
    label,
    message: String(score),
    color: colour(score),
  };
  writeFileSync(join(out, `${id}.json`), `${JSON.stringify(badge)}\n`);
  console.log(`${label}: ${score}`);
}
