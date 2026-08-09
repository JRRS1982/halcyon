# Monthly reminder email

The return loop. Balanced Money depends on a monthly habit, and until this
existed nothing brought anyone back — the app waited to be remembered.

One email a month, saying the statement should be ready. Off unless the user
turns it on.

## What the email contains — and what it deliberately doesn't

**No figures.** No balances, no totals, no category or account names. Just
"August 2026 is ready to log", a sign-in button, and a link to the guide.

Financial data is *not* special-category data under UK GDPR Art. 9 — that list
is health, ethnicity, religion, politics, union membership, genetics,
biometrics, sex life. So there is no rule against emailing someone their own
figures. The argument is Art. 32, security appropriate to the risk: a mailbox
rests on servers we don't control, gets forwarded, previews on lock screens,
and a mis-send becomes a notifiable breach.

Keeping figures out means Resend processes an email address and nothing else,
which keeps the processor relationship and the privacy notice narrow. The rule
is enforced by a test (`src/__tests__/email/reminder.test.ts`) that strips the
HTML to its visible text and asserts no currency amounts and no
separated/decimal numbers appear — so "just a small summary" can't be added
without the test objecting.

## Consent

Opt-in, `false` by default, and **not** backfilled for existing users by the
migration. Turning it on is the consent record: the column plus its `updatedAt`.

Every email carries two ways out:

- the visible **Stop these reminders** link → `/unsubscribe?token=…`
- `List-Unsubscribe` + `List-Unsubscribe-Post` headers → `POST /api/unsubscribe`
  (RFC 8058), which is what Gmail and Outlook render next to the sender

Neither requires a session. Making someone log in to stop email they didn't
want is a dark pattern, and the person who most wants out is the least likely
to remember a password.

`/unsubscribe` shows a confirm button and only acts on the **POST**. Mail
clients, corporate link scanners and browser prefetchers all fetch URLs without
a human deciding to; acting on the GET would unsubscribe people who merely
received the message. The page looks the token up on load, so an unrecognised
link says so immediately rather than offering a button that does nothing.

## Scheduling

Users pick a send day — 1st, 8th, 15th or 22nd. Statements close on different
days per bank, so a single fixed date would reach many people before there was
anything to import, which teaches them to ignore it.

The cron runs **daily** (`vercel.json`) and `isReminderDue()` decides who is
due. One schedule covers all four days, and the rule lives in tested code
rather than in a crontab expression.

Two guards:

- **Already sent this month** — compared by calendar month, not a rolling
  30-day window (which would drift a day earlier each time until it crossed
  back into the previous month and sent twice). This is what makes a second run
  on the same day a no-op.
- **A two-day retry window** — a send that fails (provider blip, rate limit,
  deploy mid-job) is left unstamped, so the next daily run picks that
  subscriber back up instead of the month being lost.

All UTC. The user's timezone would only shift which side of midnight the mail
lands on, and mixing zones would let the "is it the 8th yet" and "did we
already send" comparisons disagree at the edges.

## Where the code lives

| Path | What it is |
|---|---|
| `src/lib/email/reminder.ts` | Pure: `isReminderDue`, `buildReminder`, the day options. No Prisma, no network, no clock — the caller passes `now`. |
| `src/lib/email/send.ts` | Resend transport. A plain `fetch` to their REST API, not the SDK: the whole surface used is one POST. |
| `src/lib/email/subscriptions.ts` | The database side — who is subscribed, minting and redeeming the unsubscribe token. |
| `src/app/api/cron/monthly-reminder/route.ts` | The job. Bearer-checks `CRON_SECRET`, filters, sends, stamps. |
| `src/app/api/unsubscribe/route.ts` | RFC 8058 one-click POST, for mail clients. |
| `src/app/(app)/unsubscribe/` | The human-facing page. |
| `src/app/(app)/settings/SettingsForm.tsx` | The toggle and the send-day select. |

The address is read from **Supabase Auth** per send (`auth.admin.getUserById`).
The app has never stored email addresses in its own tables and this feature is
not a reason to start.

## Setup (owner tasks — not done by the code)

None of this is wired up until these are done. Without them the cron route
returns `{"skipped":"email not configured"}` and sends nothing, which is the
correct state for local dev, CI and preview deploys.

1. **Create a Resend account** and add `balanced.money` as a domain.
2. **Add the DNS records Resend gives you** (SPF `TXT`, DKIM `CNAME`s, and
   ideally a DMARC `TXT`). DNS is on Vercel nameservers since the Supabase
   cutover, so these go in the Vercel DNS panel. Delivery fails without them.
3. **Create a sending API key** (sending permission only).
4. **Set four environment variables in Vercel** (Production):
   - `RESEND_API_KEY` — the key from step 3
   - `EMAIL_FROM` — e.g. `Balanced Money <reminders@balanced.money>`, on the
     verified domain
   - `SITE_URL` — `https://balanced.money`
   - `CRON_SECRET` — any long random string. Vercel sends it as
     `Authorization: Bearer …` on scheduled invocations.
5. **Deploy.** `vercel.json` registers the daily cron on deploy.

To check it end to end without waiting for the schedule:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://balanced.money/api/cron/monthly-reminder
```

Returns `{"due":n,"sent":n,"failures":[]}`. It reports user ids, never email
addresses — the response goes to Vercel's logs.

**Note on the Vercel plan:** Hobby allows a limited number of cron jobs and
runs them approximately, not to the minute. That is fine here — a reminder is
not time-of-day sensitive, and the retry window absorbs a late run.

## Still open

- **No send log.** `monthlyReminderSentAt` records that the last send
  succeeded, not a history. If delivery problems ever need debugging, Resend's
  own dashboard is the record; a `ReminderSend` table would be the next step.
- **Bounce and complaint handling.** A hard bounce or a spam complaint should
  switch the subscription off automatically. That needs a Resend webhook, which
  is worth adding once there is more than one user.
