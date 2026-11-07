# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary: UK households (starting with the owner's own family) who currently run their money in a home-made spreadsheet and want structure without losing control. Detail-oriented, numerate, often technical; favourite brands in the space are Monzo and Vanguard. They visit roughly monthly for 15–60 minutes to enter the month, compare plan to reality, update balances and look ahead, plus occasional quick check-ins. Secondary audiences named in docs/user-personas.md: a retiree and a young spender.

## Product Purpose
Balanced Money replaces the DIY finance spreadsheet with a guided monthly loop: enter what happened (CSV import or typed), compare budget to actual, update balances, see where you stand, and project the future to death age. Success means the user can see what their finances may look like at a future date, review where money went, see how much they saved, and learn why keeping to a budget works.

## Positioning
A spreadsheet's honesty and control with an app's structure: per-month sheets you edit like cells, one registry of accounts feeding a long-range plan with real UK tax bands, and numbers that never invent comparisons or hide unbudgeted spending. No bank-linking, no advertising, no dark patterns. Free: no payment details, no subscriptions (Terms of Service).

## Operating Context
Monthly sessions at a desk with bank statements (CSV) at hand, where the tables do the heavy lifting; every screen must still be fully usable on a phone, including importing and categorising transactions. Recurring ritual, as /guide teaches it: 1 import last month's statement (or type the lines) → 2 approve what was categorised → 3 read the budget → 4 update balances → 5 look at the dashboard. Transactions is a Settings toggle; with it off, actuals are typed straight into the budget. Optional monthly reminder email carrying no financial data.

## Capabilities and Constraints
Features (full route list in docs/sitemap.md, step-by-step flows in docs/user-journeys/): dashboard, budget sheet (income / expense / transfer / repayment rows), balance sheet of accounts, transactions ledger with CSV import + reversible batches + filters, categories suggested from the user's own history and shown in pencil until approved, a "write a line" box for cash and one-offs, Plan (projection, events, sync from accounts and budget), settings, data export and account deletion, a light/dark colour-scheme setting. Public pages the owner values as individual pages and wants kept and improved, not merged: the guide (/guide), the engineering tour (/how-its-built), the design system (/design), privacy, cookies and terms. Privacy posture: no advertising and no profiling; every cookie strictly necessary, so no consent banner. Analytics is planned (tool not yet chosen) and AI may follow, opt-in only; either adds a processor that must be named in the Privacy Policy before it ships (docs/data-privacy-statement.md). Stack: Next.js 16, React 19, styled-components; tokens in palette.ts/theme.ts, documented in DESIGN.md and rendered live at /design. Every text colour must clear 4.5:1 and chart hues 3:1 with CVD separation (enforced by contrast.test.ts).

## Brand Commitments
Public name "Balanced Money" at balanced.money ("Balanced" in running prose); "Halcyon" is never user-facing. Voice: plain, candid, UK English, honest about uncertainty ("a range, not a single number"). The "Market Pages" look (DESIGN.md: a financial paper's markets pages, salmon paper, serif headlines, ruled tables) shipped on 5 Nov 2026, replacing a grey look the owner had rejected; refine it, do not replace it. The brief it answers, set by the owner on 30 Oct 2026: it must feel **trustworthy** and formal, like a bank or financial institution; **educational**, exposing where the user is actually spending their money; **useful**, with every element carrying real information and no page filler; and **very easy to interact with**, from updating transactions to customising the app to their preferences. Reference: Vanguard's signed-in view, a performance table of rows that is easy to read and act on. Binding aim: "users love seeing how they are doing financially."

## Evidence on Hand
Real app screenshots ("plates") in public/marketing/plates/, shot from the demo account by scripts/capture-shots.mjs (Nov 2026): the budget lead (desktop and phone), budget share of spend, cash flow, transactions, balance, plan and settings. Light-mode captures only. No testimonials, user counts, press or pricing; do not fabricate any.

## Product Principles
1. Numbers tell the truth: never invent a comparison, show ranges where the future is uncertain.
2. Spreadsheet-grade control, app-grade guidance: tables of rows are the core interface, and editing one is a single, obvious action.
3. Teach by showing: surface where money actually goes, and explain a figure where it appears rather than on a separate page.
4. Nothing is filler: every number, chart and sentence must answer a question the user has.
5. A few minutes a month: the monthly loop is the method.
6. Your data is yours: export, clear or delete without friction.

## Accessibility & Inclusion
WCAG 2.1 AA; full keyboard operation of the sheets; ARIA landmarks on every page; contrast gated in tests.
