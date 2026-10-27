# Success Metrics

**What:** The metrics I use to judge whether the app works, written as good practice for a personal project.  
**Key points:**
- Covers user value, technical health, engagement and quality
- Targets are guides, not commitments; most are measured by judgement, not tooling
- No analytics or tracking exists, by design (see the [data privacy statement](data-privacy-statement.md))
- Review and update if the app gains external users

## Business/user value (the "why")

**Problem:** There is no easy, affordable way to track and manage my family's past and future finances.

**Success means the user can:**

- See what their finances may look like at a future date.
- Review where they have spent their money.
- Review how much they have saved.
- Learn how to keep to a budget, and why it works.

## Technical performance (the "how well")

Performance and reliability are not MVP priorities; the first goal is my own learning. As a rule of thumb:

- Page load under 3 s.
- API response under 500 ms.
- Uptime over 99%. The app runs on Vercel with Supabase for Postgres and Auth, so uptime is bounded by those providers' published targets (both at least 99.9%), not by my own infrastructure.

A daily `GET /api/health` check (`.github/workflows/health.yml`) confirms production can reach its database, and emails the owner if it fails.

## Engagement (the "how much")

The app is for long-term planning and budgeting, so I expect infrequent visits:

- Typically monthly; perhaps quarterly or annually; rarely more than twice a month.
- Sessions of 15 to 60 minutes when gathering figures, adjusting the budget and reviewing plans. Some visits are quick check-ins.

## Quality (the "how good")

Foundations come before features, so code deploys and tests quickly and reliably. Test coverage is reported in CI logs but does not fail the build.

- Error rate under 1%.
- Test coverage over 80%.
- Build success rate over 90%.
