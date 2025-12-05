.PHONY: up down build logs shell db-shell clean

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
