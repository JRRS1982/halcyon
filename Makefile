.PHONY: up down build logs shell db-shell clean test test-watch test-coverage test-e2e test-e2e-ui test-e2e-docker

# Start development environment
up:
	docker compose up

# Stop containers
down:
	docker compose down

# Rebuild containers
build:
	docker compose build --no-cache

# View logs
logs:
	docker compose logs -f

# Shell into app container
shell:
	docker compose exec app sh

# Shell into database
db-shell:
	docker compose exec db psql -U postgres -d halcyon

# Remove containers, volumes, and build cache
clean:
	docker compose down -v --rmi local

# Unit tests
# Usage: make test [name=<pattern>]
test:
ifdef name
	pnpm test -- -t "$(name)"
else
	pnpm test
endif

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

# E2E tests in Docker (recommended)
# Usage: make test-e2e-docker
test-e2e-docker:
	pnpm test:e2e:docker

# E2E tests locally
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
