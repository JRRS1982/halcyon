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

## The rule that makes ordering stop mattering

Gates help. Not needing them helps more.

`mixed-schema-check` fails any PR that changes `prisma/migrations/**` *and*
application code (`src/**`, `e2e/**`) together. With that separation:

- A **migration PR** merges → `migrate-prod` runs → Vercel deploys byte-identical
  application code. Order is irrelevant.
- A **code PR** merges → `migrate-prod` is a no-op → Vercel deploys. Order is
  irrelevant.

The race only ever mattered because both halves changed at once.

Run it locally with `pnpm check:mixed-schema`. Override with the `mixed-schema-ok`
label when something genuinely has to ship together — deliberately, and visibly.

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
