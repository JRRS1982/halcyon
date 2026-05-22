# Success Metrics

This is going to be a living document of the metrics that I will use to measure the success of the app.

This is only a personal app / project, but I think it is probably good practice to write it out. If the app gets any traction, this document could be reviewed and updated on a regular basis to ensure that the app is meeting the current needs of the users.

## Business/User Value Metrics (The "Why")

### What problem does your app solve?

- The lack of an easy and affordable way to track and manage my families past and future finances.

### What user outcomes indicate success? (The "What")

The user can;

- See what their finances may look like at a future date.
- Review where they have been spending their money.
- Review how much they have saved.
- Learn how to, and the power of, keeping to a budget.

## Technical Performance Metrics (The "How Well")

As this is a personal project, I hope that the app is performant and reliable for your needs, but is not a priority for the MVP as it's first priority is for my educational needs.

- As a guide of thumb I would expect page load time (<3s), API response time (<500ms), uptime (>99%). The app is hosted on Vercel with Supabase as the managed Postgres + Auth backend, so uptime is bounded by those providers' SLAs (both publish ≥99.9% targets) rather than my own infrastructure.

## Engagement Metrics (The "How Much")

This app is intended to be user for long term planning and budgeting, so I expect users to visit infrequently.

I expect a typical user may visit monthly, but this may be quarterly or even annually, I doubt that a user will want to use it more than twice a month.

I expect a user session may be fairly long (between 15-60 minutes), as they may be gathering information from other sources and be adjusting their budget and reviewing future plans, but other users may just log in and out very quickly to review current data.

## Quality Metrics (The "How Good")

I would like to setup the foundations before shipping features, so that I have a reliable and efficient way to deploy and test code quickly. Test coverage should not break the build, but it should be included in logs to help maintain high quality code.

- Error rate (<1%), test coverage (>80%), build success rate (>90%)
