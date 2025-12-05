# ADR-004: Secret Management

- Status: Accepted
- Created by: @jrrs1982
- Date: 2025-12-05
- Decision maker: @jrrs1982

## Context

The application requires secure management of sensitive configuration values such as database credentials, API keys, and authentication secrets across different environments (development, testing, production).

Next.js will use the NODE_ENV, like so `.env.{NODE_ENV}`.

## Decision

Use environment variables for secrets management with a tiered approach:

1. **Local Development**: `.env.development` file and Docker Compose `environment` blocks in the compose.yaml file for the development NODE_ENV.
2. **Test**: Environment variables defined in `.env.test` and `environment` blocks in the compose.test.yaml` for the test NODE_ENV.
3. **Production**: Platform-native environment variable configuration (i.e. on the platform the app is running for the production NODE_ENV).

## Considered Alternatives

- None

## Implementation

- Production secrets are configured directly in the hosting platform's dashboard
- Secrets are never committed to version control
- `.env.example` documents required environment variables without values
