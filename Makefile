.PHONY: go build up down rebuild logs shell db-shell migrate-create migrate-deploy db-seed db-reset lint-and-format clean test test-watch test-coverage e2e-db test-e2e test-e2e-ui

.DEFAULT_GOAL := go

# `make` (default): start the dev environment (attached — logs stream, Ctrl-C
# stops the containers). The everyday command; assumes the DB is already
# migrated/seeded. For a from-scratch setup use `make build`.
go: down up

# `make build`: full from-scratch setup in one command — stop any running
# containers, rebuild the images, start them (detached), apply pending
# migrations, seed test data, then tail logs (Ctrl-C stops following; the
# containers keep running). Use on first run or after Dockerfile/schema changes;
# `make` is the everyday start.
build: down
	docker compose up -d --build
	@echo "Waiting for Postgres to be ready…"
	@until docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
	$(MAKE) db-seed
	docker compose logs -f

# Start development environment (attached). Does not migrate or seed — run
# `make build` for a full setup, or `make migrate-deploy` / `make db-seed`.
up:
	docker compose up

# Stop development containers
down:
	docker compose down --remove-orphans

# Rebuild the container images from scratch (no cache)
rebuild:
	docker compose build --no-cache

# View development logs
logs:
	docker compose logs -f

# Shell into app container
shell:
	docker compose exec app sh

# Shell into database
db-shell:
	docker compose exec db psql -U postgres -d halcyon

# migrate-deploy: apply every pending migration to the local dev DB
# (`prisma migrate deploy`), then regenerate the client and restart the app (via
# prisma-generate) so the running app always matches the schema. Does NOT diff
# the schema or create files — it only runs migration SQL that already exists.
# Run this after pulling new migrations from git, or after migrate-create.
# Requires the containers to be up (make / make up). NB: unlike the CI/prod
# `prisma migrate deploy`, this also regenerates + restarts (local convenience).
# Example: make migrate-deploy
migrate-deploy:
	docker compose exec app npx prisma migrate deploy
	$(MAKE) prisma-generate

# Apply migrations (via migrate-deploy) then seed test data. Requires the
# containers to be up (started by `make` / `make up`).
db-seed: migrate-deploy
	docker compose exec app npx tsx prisma/seed.ts

# Reset and seed database
db-reset:
	docker compose exec app npx prisma migrate reset --force
	docker compose exec app npx tsx prisma/seed.ts

# Link existing balance rows to accounts. Idempotent — safe to re-run.

# migrate-create: author a NEW migration from schema.prisma changes
# (`prisma migrate dev`). Diffs the schema against the DB, writes a new SQL file
# under prisma/migrations/, applies it, and regenerates the client. `name` is
# required and should start with a verb and name the table.
# Example: make migrate-create name=add_user_settings
migrate-create:
	@if [ -z "$(name)" ]; then \
		echo "Error: name is required. Usage: make migrate-create name=add_user_settings"; \
		exit 1; \
	fi
	docker compose exec app npx prisma migrate dev --name $(name)

# prisma-generate: regenerate the Prisma client in the running container and
# reload the dev server. `migrate-deploy` applies migration SQL but does NOT
# regenerate the client, so after pulling schema changes the app can load a
# stale client (symptom: Prisma "Unknown argument <field>" at runtime even
# though the column exists and migrations are applied). Run this to fix it.
# Requires the containers to be up (make / make up).
prisma-generate:
	docker compose exec app npx prisma generate
	docker compose restart app

lint-and-format:
	pnpm lint:fix
	pnpm format

# Remove containers, volumes, and build cache
clean:
	docker compose down -v --rmi local

# Unit tests
# Usage: make test [name=<pattern>]
test:
	@if [ -n "$(name)" ]; then \
		echo "Running tests matching: $(name)"; \
		node node_modules/jest/bin/jest.js --testNamePattern="$(name)"; \
	else \
		echo "Running all tests"; \
		node node_modules/jest/bin/jest.js; \
	fi

# Unit tests in watch mode
# Usage: make test-watch [name=<pattern>]
test-watch:
ifdef name
	pnpm test:watch -- -t "$(name)"
else
	pnpm test:watch
endif

# Unit tests with coverage
test-coverage:
	pnpm test:coverage

# Ensure the local Postgres is up and halcyon_test is migrated, for DB-touching
# e2e. No-op under CI, which supplies its own Postgres service. halcyon_test +
# the `test` role are provisioned by docker/postgres-init.sql on first volume
# init; the migrate deploy here is pinned to halcyon_test (never prod).
e2e-db:
ifeq ($(CI),)
	docker compose up -d db
	@until docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
	DATABASE_URL=postgresql://postgres:postgres@localhost:5432/halcyon_test?schema=public \
	DIRECT_URL=postgresql://postgres:postgres@localhost:5432/halcyon_test?schema=public \
	pnpm exec prisma migrate deploy
endif

# E2E tests (Playwright). Brings the local test DB up first.
# Runs every browser CI runs — chromium, firefox and webkit — unless you name
# one. Needs all three installed once: `pnpm exec playwright install`.
# Usage:
#   make test-e2e                                    # all three browsers
#   make test-e2e browser=firefox                    # just that browser
#   make test-e2e name="transfers journey"           # only specs/tests matching the grep
#   make test-e2e browser=webkit name="theme"        # both filters
# Call Playwright directly via `pnpm exec`: `pnpm test:e2e -- --grep` would pass
# a bare `--` to Playwright, which then reads `--grep` as a positional file
# filter ("No tests found") rather than the grep option.
E2E_ARGS :=
ifdef browser
E2E_ARGS += --project=$(browser)
endif
ifdef name
E2E_ARGS += --grep "$(name)"
endif

test-e2e: e2e-db
	pnpm exec playwright test $(E2E_ARGS)

# E2E tests with UI
test-e2e-ui:
	pnpm test:e2e:ui
