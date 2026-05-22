# Halcyon

This is a web application for managing personal finance, built to be easy to use and understand.

Please see the [Playbook](docs/Playbook.md) for more information on the project, along with the [docs](docs/) directory for more information on the architecture and design.

## Deployment

- **Development**: <http://localhost:3000/> (`pnpm dev` or `make dev-up`)
- **Production**: hosted on [Vercel](https://vercel.com) with [Supabase](https://supabase.com) for managed Postgres + Auth. Vercel's Git integration deploys `master` automatically once CI succeeds; rollback is one click in the Vercel dashboard. See [ADR-001](docs/ADRs/ADR-001-TechStackSelection.md).

## Setup

Install halcyon with pnpm, which is a fast, disk space efficient package manager for JavaScript.

```bash
  pnpm install
  pnpm run dev
```

## Documentation

I have done my best, with the support of AI to put a comprehensive set of documents in place to help me and others understand the project and its architecture.

- [Tech Stack](docs/ADRs/ADR-001-TechStackSelection.md)
- [Playbook](docs/Playbook.md)
- [Data Models](docs/DataModels/)
- [Design Decisions](docs/DesignDecisions/)
- [Security Architecture](docs/ADRs/ADR-002-SecurityArchitecture.md)
- [Auth Flow (sequence diagrams)](docs/AuthFlow.md)
- [User Personas](docs/UserPersonas.md)
- [User Journeys](docs/UserJourney.md)
- [Stakeholder Mapping](docs/StakeholderMapping.md)
- [Success Metrics](docs/SuccessMetrics.md)
- [Data Privacy Statement](docs/DataPrivacyStatement.md)
- [Design System (DESIGN.md)](DESIGN.md)
- [Accessibility Standards](docs/AccessibilityStandards.md)

## Demo

Insert gif or link to a demo of the project.

## Testing

The unit tests run against the code in the `src/` directory, rather than the container code, which improved the speed and reliability of the tests. In other projects i have worked on, running tests against the container code was a common source of frustration.

### Unit tests

To run the unit tests, use the following command: `pnpm test`, or one of the helpers listed below:

- `make test`
- `make test-watch`
- `make test-coverage`

### End to end tests (E2E)

Run the tests locally:

1. Install browser system deps once: `sudo npx playwright install-deps`.
2. Install the project deps: `pnpm install`.
3. Run the tests: `pnpm test:e2e` (or `pnpm test:e2e:ui` for the UI runner).

Playwright spins up two webservers automatically:

- a **mock Supabase Auth server** on `localhost:54321` (see [`e2e/_mock/supabase.mjs`](e2e/_mock/supabase.mjs))
- a **Next.js dev server** on `localhost:3100` (the deliberately-different port lets the test server coexist with a developer's own `pnpm dev` on `:3000`)

No real Supabase project or database is touched during E2E. Coverage and approach are documented in [`docs/AuthFlow.md`](docs/AuthFlow.md#e2e-test-coverage).

### Database Seeding

To seed the local development database, use the following command: `pnpm db:seed`, or one of the helpers listed below to seed and reset the database in the container.

- `make db-seed`
- `make db-reset`

## Contributing

Contributions are always welcome! Please open a pull request or issue to discuss any changes you would like to make.

## Feedback

If you have any feedback, please reach out to us at <fake@fake.com>
