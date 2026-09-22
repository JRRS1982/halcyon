# The release flow: what actually ships, and what stops it

Two independent systems react to a push to `master`, and the relationship
between them is the whole subject of this document. Getting it wrong has caused
two production incidents.

1. **GitHub Actions** runs `ci.yml` — lint, tests, and then `migrate-prod`,
   which applies pending Prisma migrations to production Supabase.
2. **Vercel** builds and deploys, triggered by its *own* GitHub App. It is not
   started by the workflow and is not downstream of it.

They run in parallel. Nothing in this repository sequences them.

## What sequences them: Vercel's Deployment Checks

Vercel promotes a build to production only once the GitHub checks on its
**Deployment Checks** list have passed:

| Check | On the list | Why |
|---|---|---|
| `lint-and-test` | yes | |
| `integration-tests` | yes | |
| `e2e-tests` | yes | |
| `migrate-prod` | **yes** | this is what orders migrate before deploy |
| `security-audit` | **no** | a red audit means a new advisory landed against the lockfile, not that the release is wrong |
| `mixed-schema-check` | n/a | PR-only; never runs on a push to `master` |

`migrate-prod` being on that list is the entire guarantee. Because it declares
`needs: [lint-and-test, integration-tests, e2e-tests]`, it is always the *last*
job to finish — so if Vercel is not told to wait for it, Vercel will always
promote first. There is no ordering to be had from the workflow alone.

> **The list lives in the Vercel dashboard and is invisible from this
> repository.** Changing it changes the release guarantee, silently. That is
> the single most important fact here, and the reason this document exists.

## Both failure directions have happened

A migration and a deploy are two separate actions. Whichever lands first, there
is a window where one half is live and the other is not. The two incidents are
that window, from each side:

**27 Aug 2026 — old code, new schema.** A flaky webkit test failed the master
build, so Vercel marked the deployment failed. Re-running the workflow made
`migrate-prod` apply the migration — but **a workflow re-run creates no new
deployment**. Production served pre-merge code against a post-merge schema; the
old `toPlanInput.ts` read a column the migration had just dropped, and every
signed-in `/plan` threw.

**9–14 Sep 2026 — new code, old schema.** `migrate-prod` failed (a malformed
`PROD_DIRECT_URL`, reported as `P1001` rather than an auth error, which misled
the diagnosis for days). At the time `migrate-prod` was **not** on the
Deployment Checks list, so Vercel promoted anyway — four seconds after
`e2e-tests` went green. `20260909072550_add_budget_item_notes` never reached
production while the code reading `BudgetItem.notes` was live, and `/budget`
was broken for five days.

Adding `migrate-prod` to the Deployment Checks list (17 Sep 2026) closes the
second direction: a failed migration now leaves production on old code *and*
old schema, which is consistent and safe.

The first direction is **not** closed. If a migration succeeds but promotion
does not follow, the fix is a **new deployment** — Vercel's Redeploy button, or
merging another PR. Never a workflow re-run.

## Separating migrations from code, and what that is actually worth

`mixed-schema-check` fails any PR that changes `prisma/migrations/**` *and*
application code (`src/**`, `e2e/**`) together. With that separation, neither
merge can land both halves at once:

- A **migration PR** merges → `migrate-prod` runs → Vercel promotes
  byte-identical application code.
- A **code PR** merges → `migrate-prod` has nothing pending → Vercel promotes.

**Be precise about which guard does what.** This check does *not* prevent the
September failure — `migrate-prod` on Vercel's Deployment Checks does. With the
check in place and that list still wrong, September still happens: the migration
PR merges and fails harmlessly, then the code PR merges and promotes against a
column that never arrived.

What separation changes is *when* you find out. Mixed, the migration fails at the
same instant the code that needs it goes live: production breaks immediately and
silently. Separated, the migration fails while production is still consistent —
old code, old schema, nothing broken — and the red check is visible before
anything depends on it. The outage then requires merging a second PR past a
known-red first one.

So the value is:

- **Clean reverts.** Revert a mixed PR and the migration file goes with it while
  the migration stays applied in production; `prisma/migrations/` then disagrees
  with the live database, and local `migrate dev`/`migrate status` see drift. A
  code-only PR reverts without touching schema history.
- **A warning while production is still healthy**, per above.
- **Defence in depth** — the Deployment Checks list regressed silently once and
  went unnoticed for days.
- **The precondition for expand → use → contract**, impossible if expand and use
  share a PR.

What it does **not** buy is safety. For a `DROP COLUMN` or `RENAME`, separation
*lengthens* the window in which old code meets new schema: from the couple of
minutes between migrate and promote, to however long until the follow-up code PR
ships. Only expand/contract fixes that, and no check here can verify you have
followed it.

Run it locally with `pnpm check:mixed-schema`. Override with the `mixed-schema-ok`
label when something genuinely has to ship together — deliberately, and visibly.

### e2e-tests is chained behind it, which makes the ruleset entry mandatory

`e2e-tests` declares `needs: [mixed-schema-check]`, so a PR that mixes a
migration with code is rejected in ~30 seconds instead of after ~13 minutes of
browser tests.

That chain has a consequence worth stating plainly. When the check fails,
`e2e-tests` is **skipped** — and GitHub treats a skipped required check as
satisfied (the same rule that lets `migrate-prod` report "skipping" on a PR
without blocking it). So if `mixed-schema-check` is not itself a required check,
a violating PR becomes mergeable *and* arrives having never run the browser
suite: strictly worse than not chaining at all.

**`mixed-schema-check` must be on the ruleset's required checks.** With it
there, its own red blocks the merge and the skipped `e2e-tests` never gets the
chance to matter.

The job also carries an explicit condition:

```yaml
if: ${{ !cancelled() && needs.mixed-schema-check.result != 'failure' }}
```

Without it, the default "a skipped dependency skips its dependents" rule would
skip `e2e-tests` on every push to master — where `mixed-schema-check` never runs
— and `migrate-prod` needs `e2e-tests`. Releases would quietly stop migrating.

### Where the check belongs, and two places it does not

`mixed-schema-check` runs on pull requests only. It is enforced by being on the
**ruleset's required checks**, because a PR is the last moment at which there is
still something to reject.

Two tempting wirings both break it, and neither fails loudly:

- **`needs: [mixed-schema-check]` on `migrate-prod`.** The two jobs are mutually
  exclusive by construction — one is PR-only, the other push-to-master-only — so
  on master the check is skipped, and a job whose dependency is skipped is
  skipped too. `migrate-prod` would silently stop running, a skipped check
  satisfies both gates, and the deploy would go out with no migration applied.
  That is the September 2026 outage, rebuilt out of the guard meant to prevent
  it.
- **Adding it to Vercel's Deployment Checks.** Same cause: it never runs on a
  master push, so it either never arrives or counts as satisfied. Either way it
  gates nothing.

There is also nothing useful for it to do at release time. By the time
`migrate-prod` runs the merge has already happened; refusing to migrate then
does not prevent a mixed change, it *creates* the broken state — merged code,
un-migrated schema. Once code is on master, migrating is the only safe move.

### Separation is not safety

A PR containing *only* a `RENAME` or `DROP COLUMN` still breaks production the
moment it applies, because the running code predates it. Separation buys you
the freedom to sequence; it does not sequence for you. The discipline is
**expand → use → contract**:

1. **Expand** (own PR): additive only — nullable column, new table, new index.
   Old code keeps working against the new schema.
2. **Use** (own PR): the code starts reading it. The column already exists, so
   either order is safe.
3. **Contract** (own PR, later): drop the old thing, once nothing reads it.

`mixed-schema-check` reports backward-incompatible statements rather than blocking
them — it cannot tell an unsafe change from a legitimate contract step. The
report is a prompt: *is the code that used the old shape already gone?*

## Verifying a release

CI green does not mean deployed, and the workflow's own state is the wrong
thing to read. Check the deployment:

```sh
gh api repos/JRRS1982/halcyon/deployments \
  --jq '[.[] | select(.environment=="Production")][0] | "\(.sha[0:7]) \(.created_at)"'
gh api repos/JRRS1982/halcyon/deployments/<id>/statuses --jq '.[].state'
```

Then confirm the running app, not just the deployment record:

- `GET /api/health` → `200 {"status":"ok","db":"ok"}` — proves the deployment is
  serving *and* can reach the database. The `smoke` workflow asserts this
  automatically on every successful production deployment.
- A signed-out authed route (`/budget`, `/plan`) should be **307 → /sign-in**.
  A **500** there is the schema/code split.
