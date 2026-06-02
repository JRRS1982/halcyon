-- Runs once, on first initialisation of the Postgres data volume (mounted into
-- the db container's /docker-entrypoint-initdb.d/). Provisions everything the
-- test suites need alongside the dev `halcyon` database:
--
--   * halcyon_test — the database integration tests (pnpm test:int) and the
--     Playwright e2e dev server both point at.
--   * role `test` (password `test`, superuser) — the credentials the e2e dev
--     server uses (see playwright.config.ts), matching the CI Postgres service.
--
-- Idempotent guards so a re-run (or a manual psql apply against an existing
-- volume) is harmless. CI supplies its own Postgres service and does not use
-- this file.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'test') THEN
    CREATE ROLE test LOGIN PASSWORD 'test' SUPERUSER;
  END IF;
END
$$;

SELECT 'CREATE DATABASE halcyon_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'halcyon_test')\gexec

GRANT ALL PRIVILEGES ON DATABASE halcyon_test TO test;
