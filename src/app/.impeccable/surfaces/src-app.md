---
version: 1
slug: "src-app"
primary_target: "src/app"
related_targets: []
---

# Surface brief: the signed-in app (and its public pages)

Scope: every page under src/app — the six signed-in screens (transactions, budget, balance, dashboard, plan, settings) plus the public guide, engineering tour, design system and legal pages. Mode: Operate (Read for the public pages). Replaces the old monochrome spreadsheet look wholesale.

Audience and job: UK households who ran their money in a spreadsheet. Monthly desk session (import, compare, update, look ahead), phone for check-ins and categorising. Every screen must answer "how am I doing, and where did it go?" before any control.

Constraints: no invented numbers or claims; every sentence of written feedback is computed by pure functions in src/lib from the user's own data (AI phrasing may layer on later, opt-in). Contrast gated by palette.contrast.test.ts; light and dark schemes both supported.

Chosen direction: Market Pages. Memorable moment: the month's verdict written as a headline over a market-data table of your categories.

Unresolved: dark-scheme rendition of the paper ground; whether the six-month history column ships in the first pass or with the feedback engine; per-page treatments beyond Budget.

## Direction contract

THESIS: Your money read like the markets page of a serious financial paper: every category a quoted line with its change against plan, its recent history and its share of spend. Refuses the fintech default of KPI cards over a progress-bar table.

OWN-WORLD: Warm salmon paper ground (own tint, never a copy of any paper's trademark value), near-black warm ink, claret as the house accent for kickers, active nav and headline emphasis, oxford blue for primary actions and links, teal for positive, a muted red for adverse. Section codes: Fixed oxford, Variable burnt orange, Discretionary claret. Editorial serif for headlines, section rows and big figures; a sturdy grotesk for tables and UI with tabular figures. Hairline rules, a heavy rule under table heads, square-ish 2px corners, no cards with shadows.

STORY: The visitor reads the verdict headline and standfirst, sees which rows moved (▲▼ against budget), learns why from the brief panel, then edits a row in place. They come away knowing where the money went and trusting the figures because every sentence traces to a row.

FIRST VIEWPORT: Masthead (serif wordmark, sign-out) over a plain text nav with a claret underline on the active page. Left column: claret kicker "BUDGET · OCTOBER 2026", serif headline verdict, one-sentence standfirst, one toolbar row (primary Add in oxford, then secondary actions, month stepper right-aligned, Delete apart). Below: the market-data table — Category, Budget, Actual, vs budget (▲▼ coloured), 6 months sparkline, Share of spend bar with %. Serif section rows carry their colour code. Right column (~340px): "The month in brief" — Left over as a big serif figure with its gap to plan, then two or three computed notes with claret lead-ins.

FORM: Market Pages, my top-ranked grounded candidate (1 of 7), chosen by the user over the rolled assignment (Plain Service, 4 of 7). seed:6084550ad1fbd461

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
