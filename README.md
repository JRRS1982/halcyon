# Halcyon

This is a web application for managing personal finance, built to be easy to use and understand.

Please see the [Playbook](docs/Playbook.md) for more information on the project, along with the [docs](docs/) directory for more information on the architecture and design.

## Deployment

When running, this project is deployed to:

- Development: <http://localhost:3000/>

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
- [User Personas](docs/UserPersonas.md)
- [User Journeys](docs/UserJourney.md)
- [Stakeholder Mapping](docs/StakeholderMapping.md)
- [Success Metrics](docs/SuccessMetrics.md)
- [Data Privacy Statement](docs/DataPrivacyStatement.md)
- [Design System Standards](docs/DesignSystemStanards.md)
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

To run the e2e tests in an isolated container, use the following command pnpm `test:e2e:docker` or the helper `make test-e2e-docker`.

Or to run the tests locally, use the following commands:

1. Install the dependencies for Playwright; `sudo npx playwright install-deps`.

2. Install the dependencies for the project; `pnpm install`.

3. run the tests; `pnpm test:e2e`, or `pnpm test:e2e:ui` to open the UI.

#### How Dockerized E2E Works

The `make test-e2e-docker` command runs tests in an isolated container environment:

- **`compose.test.yaml`** — Orchestrates the test environment (app + database)
- **`Dockerfile.test`** — Builds the test image with Node.js, Chromium, and the app
- **`playwright.config.ts`** — Configures Playwright to use Alpine's system Chromium (bundled browsers don't work on node Alpine, which i am using to keep bundle size down)

This ensures tests run consistently regardless of your local setup.

## Contributing

Contributions are always welcome! Please open a pull request or issue to discuss any changes you would like to make.

## Feedback

If you have any feedback, please reach out to us at <fake@fake.com>
