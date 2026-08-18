// Rasterises src/app/icon.svg into the PNG set the web app manifest and iOS
// need, using the repo's existing Playwright chromium (sharp is only a
// transitive dependency here and pnpm's strict layout keeps it unimportable).
// Re-run after changing the mark: node scripts/generate-icons.mjs
//
//   public/icon-{192,512}.png           — manifest "any" icons (the rounded
//                                         mark on transparency, as designed)
//   public/icon-maskable-{192,512}.png  — full-bleed band-dark square with the
//                                         mark inside the ~80% safe zone, for
//                                         launchers that crop to their own shape
//   src/app/apple-icon.png              — 180px full-bleed square; iOS applies
//                                         its own corner radius
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("src/app/icon.svg", "utf8");
const BAND = "#0F1116"; // colors.band — the mark's own background

const browser = await chromium.launch();

const shoot = async ({ size, out, fullBleed }) => {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
  });
  const inner = fullBleed ? Math.round(size * 0.78) : size;
  const html = `<!doctype html><style>
    html, body { margin: 0; width: ${size}px; height: ${size}px;
      background: ${fullBleed ? BAND : "transparent"};
      display: grid; place-items: center; }
    svg { width: ${inner}px; height: ${inner}px; }
  </style>${svg}`;
  await page.setContent(html);
  await page.screenshot({ path: out, omitBackground: !fullBleed });
  await page.close();
  console.log("wrote", out);
};

await shoot({ size: 192, out: "public/icon-192.png" });
await shoot({ size: 512, out: "public/icon-512.png" });
await shoot({
  size: 192,
  out: "public/icon-maskable-192.png",
  fullBleed: true,
});
await shoot({
  size: 512,
  out: "public/icon-maskable-512.png",
  fullBleed: true,
});
await shoot({ size: 180, out: "src/app/apple-icon.png", fullBleed: true });

await browser.close();
