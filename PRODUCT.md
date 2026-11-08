# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
**Who uses it today:** UK households only, and in practice mostly the owner. Other countries may come later; the currency setting already lets a non-UK user run the budget and balance pages, though the plan's tax engine is UK-only.

**Primary audience to design for: the young spender** (docs/user-personas.md). Most people want to get control of and understand their spending before they plan for the future, and they have little motivation or interest in money admin. Design for minimal friction, so that they actually do it: one obvious next step, no jargon, a payoff on the first visit. Planning is the upsell once they are in, not the pitch at the door.

**Secondary:** the detail-oriented planner who runs a home-made spreadsheet today (the owner's own profile: numerate, technical, likes Monzo and Vanguard), and the retiree who mainly asks "will the money last?". Some users will want only balances and the plan, with no transactions at all.

**Visits:** roughly monthly for 15–60 minutes, plus quick check-ins.

## Product Purpose
Balanced Money gets people in control of their spending first, then grows into a long-range plan. It replaces the DIY finance spreadsheet, which is simple but offline and needs manual updating and correcting, with a guided monthly loop: enter what happened (CSV import or typed), compare budget to actual, update balances, see where you stand, and project the future to death age. Success means the user can see what their finances may look like at a future date, review where money went, see how much they saved, and learn why keeping to a budget works.

## Positioning
A spreadsheet's honesty and control with an app's structure: per-month sheets you edit like cells, one registry of accounts feeding a long-range plan with real UK tax bands, and numbers that never invent comparisons or hide unbudgeted spending. No bank-linking, no advertising, no dark patterns. Free for now: no payment details, no subscriptions (Terms of Service). The owner intends to earn from it later, so copy must never promise "free for ever". The competitor is the home-made spreadsheet: simple, but not on the web, and it needs updating, correcting and manual entry.

## Operating Context
Monthly sessions at a desk with bank statements (CSV) at hand, where the tables do the heavy lifting; every screen must still be fully usable on a phone, including importing and categorising transactions. How each part is filled in: transactions are imported (CSV), budget values and balances are typed. Recurring ritual, as /guide teaches it: 1 import last month's statement (or type the lines) → 2 approve what was categorised → 3 read the budget → 4 update balances → 5 look at the dashboard. Transactions is a Settings toggle; with it off, actuals are typed straight into the budget. Optional monthly reminder email carrying no financial data.

## Capabilities and Constraints
Features (full route list in docs/sitemap.md, step-by-step flows in docs/user-journeys/): dashboard, budget sheet (income / expense / transfer / repayment rows), balance sheet of accounts, transactions ledger with CSV import + reversible batches + filters, categories suggested from the user's own history and shown in pencil until approved, a "write a line" box for cash and one-offs, Plan (projection, events, sync from accounts and budget), settings, data export and account deletion, a light/dark colour-scheme setting. Public pages the owner values as individual pages and wants kept and improved, not merged: the guide (/guide), the engineering tour (/how-its-built), the design system (/design), privacy, cookies and terms. Privacy posture: no advertising and no profiling; every cookie strictly necessary, so no consent banner. Analytics is planned, to learn how people use the app and where their pain points are (where they spend most time); tool not yet chosen. AI may follow, opt-in only; either adds a processor that must be named in the Privacy Policy before it ships (docs/data-privacy-statement.md). Stack: Next.js 16, React 19, styled-components; tokens in palette.ts/theme.ts, documented in DESIGN.md and rendered live at /design. Every text colour must clear 4.5:1 and chart hues 3:1 with CVD separation (enforced by contrast.test.ts).

## Brand Commitments
Public name "Balanced Money" at balanced.money ("Balanced" in running prose); "Halcyon" is never user-facing. Voice: plain, candid, UK English, honest about uncertainty ("a range, not a single number"). The "Market Pages" look (DESIGN.md: a financial paper's markets pages, salmon paper, serif headlines, ruled tables) shipped on 5 Nov 2026, replacing a grey look the owner had rejected; refine it, do not replace it. The brief it answers, set by the owner on 30 Oct 2026: it must feel **trustworthy** and formal, like a bank or financial institution; **educational**, exposing where the user is actually spending their money; **useful**, with every element carrying real information and no page filler; and **very easy to interact with**, from updating transactions to customising the app to their preferences. Reference: Vanguard's signed-in view, a performance table of rows that is easy to read and act on. Binding aim: "users love seeing how they are doing financially."

## Evidence on Hand
Real app screenshots ("plates") in public/marketing/plates/, shot from the demo account by scripts/capture-shots.mjs (Nov 2026): the budget lead, budget share of spend, cash flow, transactions, balance, plan and settings, each but settings with a phone plate shot at 390px, and every one in light and dark. No testimonials, user counts, press or pricing; do not fabricate any.

## Direction (owner, 8 Nov 2026)
- **Learn**, eventually: short, clear, educational articles for people who neither understand nor care about money yet. What an ISA or a SIPP is, why and at what stage of life to pay into each, the platform, fund and activity fees providers charge and their impact on a retirement pot; financial independence and early retirement (FIRE): saving rate, compounding and the point where investments cover spending, with interactive graphs. Write it from first principles and name no individual authors or blogs. The article template behind /features/<slug> is meant to be reused for this.
- **Plan can be switched off:** a user who only wants spending, or only balances, should be able to hide Plan, and then it leaves the menus. On by default: Plan is the upsell, so it stays visible. Built Nov 2026 as the Show Plan switch in Settings; hiding it deletes nothing.

## Product Principles
1. Numbers tell the truth: never invent a comparison, show ranges where the future is uncertain.
2. Spreadsheet-grade control, app-grade guidance: tables of rows are the core interface, and editing one is a single, obvious action.
3. Teach by showing: surface where money actually goes, and explain a figure where it appears rather than on a separate page. Longer explainers (ISAs, pensions, fees, FIRE) belong in short Learn articles, linked from where the question arises.
4. Nothing is filler: every number, chart and sentence must answer a question the user has.
5. A few minutes a month: the monthly loop is the method.
6. Your data is yours: export, clear or delete without friction.
7. Spending first, planning second: the first visit pays off with "where did my money go", for someone with no interest in money admin. Planning is offered once they are in, never required to get value.

## Accessibility & Inclusion
WCAG 2.1 AA; full keyboard operation of the sheets; ARIA landmarks on every page; contrast gated in tests.
