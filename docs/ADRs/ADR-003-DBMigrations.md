# ADR-003: DB Migrations

- Status: Accepted
- Created by: @jrrs1982
- Date: 2025-12-05
- Decision maker: @jrrs1982

## Context

I am currently setting up the database migration scripts and would like to document my preference for not having a rollback script in this app, as Prisma does not support it, thus manual SQL would be required for each rollback and forward only migrations are safer as they are less error-prone.

## Decision

I have decided to not have a rollback script.

## Considered Alternatives

- Having a rollback script

### Consequences

- Good: Forward only migrations are safer as they are less error-prone, and will force me to consider a migration deeply before I write it.
- Bad: Not having a rollback script means that I will have to create a new migration for any errors I include in a migration.
