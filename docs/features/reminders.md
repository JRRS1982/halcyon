# Monthly reminder email

**What:** An optional monthly email nudge on a user-chosen day, sent through Resend. Off by default; opt-in from Settings.  
**Key points:**
- The cron job at `src/app/api/cron/monthly-reminder/route.ts` runs daily and sends only to users whose reminder day is due.
- The email carries no financial data, only a prompt to open the app.
- The opt-out link (`/unsubscribe?token=…`) works without a session. The token is a random 256-bit per-user value, not a signed one.
- Without Resend keys the cron route returns `{"skipped":"email not configured"}` and sends nothing.

Balanced Money depends on a monthly habit, and nothing else brings people back. This email does: one a month, saying the statement should be ready.

## What the email contains — and what it deliberately doesn't

**No figures.** No balances, no totals, no category or account names. Just
"Your August 2026 catch-up", the three steps of the habit in general terms, a
button to the work and a link to the guide.

The wording follows the user's mode: a transactions user is told to import and
categorise, a manual user to enter what they spent. The button goes to
`/transactions` or `/budget` to match.

Financial data is *not* special-category data under UK GDPR Art. 9 — that list
is health, ethnicity, religion, politics, union membership, genetics,
biometrics, sex life. So there is no rule against emailing someone their own
figures. The argument is Art. 32, security appropriate to the risk: a mailbox
rests on servers we don't control, gets forwarded, previews on lock screens,
and a mis-send becomes a notifiable breach.

Keeping figures out means Resend processes an email address and nothing else,
which keeps the processor relationship and the privacy notice narrow. A test
(`tests/unit/lib/email/reminder.test.ts`) enforces the rule: it strips the HTML
to its visible text and asserts no currency amounts and no separated or decimal
numbers appear.

## Consent

Opt-in, `false` by default, and **not** backfilled for existing users by the
migration. Turning it on is the consent record: the column plus its `updatedAt`.

Every email carries two ways out:

- the visible **Stop these reminders** link → `/unsubscribe?token=…`
- `List-Unsubscribe` + `List-Unsubscribe-Post` headers → `POST /api/unsubscribe`
  (RFC 8058), which is what Gmail and Outlook render next to the sender

Neither requires a session: the person who most wants out is the least likely
to remember a password. The token is `UserSettings.unsubscribeToken`, minted
when the reminder is first enabled. It is not rotated on use, so an old link
clicked twice reports "already off". The POST endpoint is rate-limited per IP
and answers 200 for an unknown token.

`/unsubscribe` shows a confirm button and only acts on the **POST**. Mail
clients, corporate link scanners and browser prefetchers all fetch URLs without
a human deciding to; acting on the GET would unsubscribe people who merely
received the message. The page looks the token up on load, so an unrecognised
link says so immediately rather than offering a button that does nothing.

## Scheduling

Users pick a send day — 1st, 8th, 15th or 22nd. Statements close on different
days per bank, so a single fixed date would reach many people before there was
anything to import, which teaches them to ignore it.

The cron runs **daily at 09:00 UTC** (`vercel.json`) and `isReminderDue()`
decides who is due. One schedule covers all four days, and the rule lives in
tested code rather than in a crontab expression.

Two guards:

- **Already sent this month** — compared by calendar month, not a rolling
  30-day window (which would drift a day earlier each time until it crossed
  back into the previous month and sent twice). This is what makes a second run
  on the same day a no-op.
- **A retry window** (`REMINDER_RETRY_DAYS`, two days after the chosen day) — a send that fails (provider blip, rate limit,
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
| `src/lib/email/subscriptions.ts` | The database side — who is subscribed, minting and redeeming the unsubscribe token, stamping a send, logging a `SentMessage`. |
| `src/app/api/cron/monthly-reminder/route.ts` | The job. Bearer-checks `CRON_SECRET`, filters, sends, stamps, logs. |
| `src/app/api/unsubscribe/route.ts` | RFC 8058 one-click POST, for mail clients. |
| `src/app/(app)/unsubscribe/` | The human-facing page. |
| `src/app/(app)/settings/SettingsForm.tsx` | The toggle and the send-day select. Both save immediately through `toggleMonthlyReminder` and `setMonthlyReminderDay` in `actions.ts`. |

The address is read from **Supabase Auth** per send (`auth.admin.getUserById`).
The app has never stored email addresses in its own tables and this feature is
not a reason to start.

## Configuration

Four environment variables in Vercel (Production) switch the feature on. Without
them the cron route sends nothing, which is the right state for local dev, CI
and preview deploys.

- `RESEND_API_KEY` — a sending-only key
- `EMAIL_FROM` — e.g. `Balanced Money <reminders@balanced.money>`, on a domain verified in Resend (SPF, DKIM and ideally DMARC records in the Vercel DNS panel)
- `SITE_URL` — `https://balanced.money`
- `CRON_SECRET` — a long random string. Vercel sends it as `Authorization: Bearer …` on scheduled invocations. Without it the route refuses every request.

`vercel.json` registers the cron on deploy.

To check it end to end without waiting for the schedule:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://balanced.money/api/cron/monthly-reminder
```

Returns `{"due":n,"sent":n,"failures":[]}`. It reports user ids, never email
addresses — the response goes to Vercel's logs.

## Still open

- **Send history is thin.** Each attempt writes a `SentMessage` row (`SENT` or `FAILED`, with the provider's error), and `monthlyReminderSentAt` stamps the last success. There is no delivery or bounce data beyond what Resend returns at send time.
- **Bounce and complaint handling.** A hard bounce or a spam complaint should switch the subscription off automatically. That needs a Resend webhook. Not yet built; worth adding once there is more than one user.
