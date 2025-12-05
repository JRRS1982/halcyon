.DEFAULT_GOAL := go

.PHONY: go
go: down up

# Start development environment
.PHONY: up
up:
	docker compose up

# Stop containers
.PHONY: down
down:
	docker compose down --remove-orphans

# Rebuild containers
.PHONY: build
build:
	docker compose build --no-cache

# View logs
.PHONY: logs
logs:
	docker compose logs -f

# Shell into app container
.PHONY: shell
shell:
	docker compose exec app sh

# Shell into database
.PHONY: db-shell
db-shell:
	docker compose exec db psql -U postgres -d halcyon

# Seed database with test data
.PHONY: db-seed
db-seed:
	docker compose exec app npx prisma migrate deploy
	docker compose exec app npx tsx prisma/seed.ts

# Reset and seed database
.PHONY: db-reset
db-reset:
	docker compose exec app npx prisma migrate reset --force
	docker compose exec app npx tsx prisma/seed.ts

# Create a new migration
# Usage: make db-migrate name=add_user_settings, the name should start with a verb and include the table name
.PHONY: db-migrate
db-migrate:
	@if [ -z "$(name)" ]; then \
		echo "Error: name is required. Usage: make db-migrate name=migration_name"; \
		exit 1; \
	fi
	docker compose exec app npx prisma migrate dev --name $(name)

.PHONY: lintAndFormat
lintAndFormat:
	pnpm lint:fix
	pnpm format

# Remove containers, volumes, and build cache
.PHONY: clean
clean:
	docker compose down -v --rmi local

# Unit tests
# Usage: make test [name=<pattern>]
.PHONY: test
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
.PHONY: test-watch
test-watch:
ifdef name
	pnpm test:watch -- -t "$(name)"
else
	pnpm test:watch
endif

# Unit tests with coverage
.PHONY: test-coverage
test-coverage:
	pnpm test:coverage

# E2E tests in Docker (recommended)
# Usage: make test-e2e-docker
.PHONY: test-e2e-docker
test-e2e-docker:
	pnpm test:e2e:docker

# E2E tests locally
# Usage: make test-e2e [name=<pattern>]
.PHONY: test-e2e
test-e2e:
ifdef name
	pnpm test:e2e -- --grep "$(name)"
else
	pnpm test:e2e
endif

# E2E tests with UI
.PHONY: test-e2e-ui
test-e2e-ui:
	pnpm test:e2e:ui
