# The release flow

Two systems react to a push to `master`, independently:

1. **GitHub Actions** runs `ci.yml` — lint, tests, then `migrate-prod`, which
   applies pending Prisma migrations to production Supabase.
2. **Vercel** builds and deploys, triggered by its own GitHub App. It is *not*
   started by the workflow.

Nothing in this repository sequences them.

## What sequences them: Vercel's Deployment Checks

Vercel promotes a build only once these GitHub checks pass:

`lint-and-test` · `integration-tests` · `e2e-tests` · **`migrate-prod`**

That last one is the whole guarantee. `migrate-prod` declares `needs:` on the
other three, so it always finishes last — if Vercel is not told to wait for it,
Vercel always promotes first.

> **The list lives in the Vercel dashboard and is invisible from this
> repository.** Changing it changes the release guarantee, silently.

`security-audit` is deliberately off the list: a red audit means a new advisory
landed against the lockfile, not that the release is wrong.

## Both failure directions have happened

| | Direction | Cause |
|---|---|---|
| 27 Aug 2026 | old code, new schema | a workflow re-run migrated but **created no deployment**; `/plan` threw |
| 9–14 Sep 2026 | new code, old schema | `migrate-prod` failed; it was **not yet on the Deployment Checks list**, so Vercel promoted 4s after `e2e-tests`. `/budget` was broken for 5 days |

Adding `migrate-prod` to the list (17 Sep 2026) closes the second. **The first is
still open:** if a migration succeeds but promotion does not follow, the fix is a
*new deployment* — Vercel's Redeploy, or another merge. Never a workflow re-run.

## `mixed-schema-check`

Fails a PR that changes `prisma/migrations/**` *and* application code
(`src/**`, `e2e/**`). Run locally with `pnpm check:mixed-schema`; the
`mixed-schema-ok` label overrides it.

**What it buys:** clean reverts (revert a mixed PR and the migration file goes
with it while the migration stays applied — `prisma/migrations/` then disagrees
with the database); a red signal while production is still *consistent*, before
anything depends on the missing column; defence in depth if the Deployment
Checks list regresses again; and the precondition for expand → use → contract.

**What it does not buy:** safety. It would not have prevented September — the
Deployment Checks entry does that. And for a `DROP COLUMN` or `RENAME`,
separation *lengthens* the window where old code meets new schema, from minutes
to however long until the follow-up code PR ships. Only expand → use → contract
fixes that, and nothing here can verify you followed it.

### It must be a required check

`integration-tests` and `e2e-tests` declare `needs: [mixed-schema-check]`, so a
violating PR is rejected in ~30s rather than after ~5 and ~14 minutes.
`lint-and-test` stays unchained — fastest job, likeliest to fail, should always
report.

When the check fails those two are **skipped**, and GitHub counts a skipped
required check as *satisfied*. So without `mixed-schema-check` in the required
list, a violating PR is mergeable having run only lint — worse than not chaining.

Both chained jobs carry:

```yaml
if: ${{ !cancelled() && needs.mixed-schema-check.result != 'failure' }}
```

Without it, the default "a skipped dependency skips its dependents" rule would
skip them on every push to master — where `mixed-schema-check` never runs — and
`migrate-prod` needs `e2e-tests`. Releases would quietly stop migrating.

### Two wirings that look tighter and are not

- **`needs: [mixed-schema-check]` on `migrate-prod`.** Same skip cascade, with
  nothing left to catch it: `migrate-prod` stops running, a skipped check
  satisfies both gates, and the deploy goes out unmigrated.
- **Adding it to Vercel's Deployment Checks.** It never runs on a master push,
  so it either never arrives or counts as satisfied.

There is also nothing for it to do at release time: by then the merge has
happened, and refusing to migrate *creates* the broken state rather than
preventing it.

## Verifying a release

CI green does not mean deployed. Read the deployment, not the workflow:

```sh
gh api repos/JRRS1982/halcyon/deployments \
  --jq '[.[] | select(.environment=="Production")][0] | "\(.sha[0:7]) \(.created_at)"'
gh api repos/JRRS1982/halcyon/deployments/<id>/statuses --jq '.[].state'
```

Then the running app. Two workflows do this automatically:

| | Question | Trigger |
|---|---|---|
| `health.yml` | is production alive? | daily, 08:00 UTC |
| `smoke.yml` | did *this deployment* work? | `deployment_status` |

Both probe `GET /api/health` (bearer-gated, `SELECT 1`) expecting
`200 {"ok":true}`.

`smoke.yml` cannot be a step in `ci.yml`: that workflow finishes before Vercel
promotes, so nothing in it can run *after* a deploy. `deployment_status` is the
only signal that the deployed thing changed.

It fires on **every** production promotion — a merge, a dashboard Redeploy, or a
rollback — and checks out `github.event.deployment.sha` rather than the branch
tip, so a rollback is judged by the spec that shipped with the commit it
promoted. The run is named after that commit (`Smoke <sha> → Production`) and
its summary carries the sha, subject, URL and deployment id, so a red row in the
Actions list names the deploy that broke it without opening anything.

**Two Playwright configs, and they must not overlap.** `playwright.config.ts`
runs `e2e/` against a local dev server and mock Supabase;
`playwright.smoke.config.ts` runs `e2e/smoke/` against a deployed URL with no
`webServer`. The main config carries `testIgnore: "**/smoke/**"` — without it
`testDir: "./e2e"` sweeps the smoke suite into the local run, where the
bearer-gated health probe has no `CRON_SECRET` and fails on all three engines
against a deployment that was never under test. **A 401 means `CRON_SECRET` in GitHub does not match
Vercel's — a drifted secret, not an outage.** `smoke.yml` additionally checks
that signed-out authed routes return **307 → /sign-in**; a **500** there is the
schema/code split.
