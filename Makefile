.PHONY: go dev-up dev-down dev-build dev-logs dev-shell dev-db-shell migrate-create migrate-deploy dev-db-seed dev-db-reset lintAndFormat dev-clean test test-watch test-coverage test-e2e test-e2e-ui

.DEFAULT_GOAL := go

go: dev-down dev-up

# Start development environment
dev-up:
	docker compose up

# Stop development containers
dev-down:
	docker compose down --remove-orphans

# Rebuild development containers
dev-build:
	docker compose build --no-cache

# View development logs
dev-logs:
	docker compose logs -f

# Shell into app container
dev-shell:
	docker compose exec app sh

# Shell into database
dev-db-shell:
	docker compose exec db psql -U postgres -d halcyon

# migrate-deploy: apply every pending migration to the local dev DB
# (`prisma migrate deploy`). Does NOT diff the schema or create files — it only
# runs migration SQL that already exists. Idempotent. Run this after pulling new
# migrations from git, or after migrate-create, so the running app matches the
# schema. Requires the containers to be up (make / make dev-up).
# Example: make migrate-deploy
migrate-deploy:
	docker compose exec app npx prisma migrate deploy

# Seed database with test data
dev-db-seed:
	docker compose exec app npx prisma migrate deploy
	docker compose exec app npx tsx prisma/seed.ts

# Reset and seed database
dev-db-reset:
	docker compose exec app npx prisma migrate reset --force
	docker compose exec app npx tsx prisma/seed.ts

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

.PHONY: lintAndFormat
lintAndFormat:
	pnpm lint:fix
	pnpm format

# Remove containers, volumes, and build cache
dev-clean:
	docker compose down -v --rmi local

# Unit tests
# Usage: make test [name=<pattern>]
test:
	@if [ -n "$(name)" ]; then \
		echo "Running tests matching: $(name)"; \
		node --experimental-vm-modules node_modules/jest/bin/jest.js --testNamePattern="$(name)"; \
	else \
		echo "Running all tests"; \
		node --experimental-vm-modules node_modules/jest/bin/jest.js; \
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

# E2E tests
# Usage: make test-e2e [name=<pattern>]
test-e2e:
ifdef name
	pnpm test:e2e -- --grep "$(name)"
else
	pnpm test:e2e
endif

# E2E tests with UI
test-e2e-ui:
	pnpm test:e2e:ui
