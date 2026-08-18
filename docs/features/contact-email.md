# Contact email (hello@balanced.money)

The legal pages (`/privacy`, `/cookies`, `/terms`) name `hello@balanced.money`
as the contact address — UK GDPR requires the data controller to be
contactable, and the E-Commerce Regulations require an email address on the
site. This doc records how that address actually works, because nothing in
the codebase implements it: it is pure DNS + a third-party forwarder.

## How it works

Inbound mail to `@balanced.money` is handled by **ImprovMX** (free tier):
their MX servers receive the message and forward it to the owner's personal
inbox. The forwarding destination is configured in the ImprovMX dashboard and
is deliberately **not** recorded in this public repo.

There is no mailbox and no IMAP — replies sent *as* `hello@` would need
Gmail's "Send mail as" with SMTP credentials (ImprovMX or Resend can provide
these); as of August 2026 that is not set up, and replies come from the
owner's own address.

## DNS records (Vercel DNS, apex)

| Type | Value                                  | Priority |
| ---- | -------------------------------------- | -------- |
| MX   | `mx1.improvmx.com`                     | 10       |
| MX   | `mx2.improvmx.com`                     | 20       |
| TXT  | `v=spf1 include:spf.improvmx.com ~all` | —        |

Set up 2026-08-18 and verified end-to-end (test mail delivered). The domain's
nameservers are Vercel's (`ns1/ns2.vercel-dns.com`), so these records are
managed in the Vercel dashboard → Domains → balanced.money → DNS Records.

## Gotchas

- **One SPF record per domain.** If outbound sending (Resend) ever needs SPF
  on the apex rather than a subdomain, merge its `include:` into the existing
  TXT record — never add a second `v=spf1` record.
- **ImprovMX is a data processor.** It sees the sender address and content of
  every email sent to the contact address, so it is disclosed in the privacy
  policy's processor table alongside Supabase, Vercel, and Resend. If the
  forwarder is ever swapped, update `/privacy` in the same change.
- **Debugging delivery**: the ImprovMX dashboard has per-message logs
  (received / forwarded / rejected). First forwards to a fresh Gmail
  destination can land in spam until Gmail learns the pattern.

## Related

- Outbound email (the monthly reminder): [reminders.md](reminders.md)
- Privacy posture and maintainer rules: [../DataPrivacyStatement.md](../DataPrivacyStatement.md)
