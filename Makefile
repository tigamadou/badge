.PHONY: dev dev-down dev-build prod prod-down prod-build prod-logs prod-seed test lint typecheck build logs upload deploy

# Développement
dev:
	docker compose -f docker-compose.dev.yml up -d

dev-build:
	docker compose -f docker-compose.dev.yml up --build -d

dev-down:
	docker compose -f docker-compose.dev.yml down

# Production
prod:
	docker compose up -d

prod-build:
	docker compose down && docker compose up --build -d

prod-down:
	docker compose down

prod-logs:
	docker compose logs -f

prod-seed:
	docker exec investiture-app npx prisma db seed

# Commandes dans le conteneur dev
test:
	docker compose -f docker-compose.dev.yml exec app yarn vitest run

lint:
	docker compose -f docker-compose.dev.yml exec app yarn lint

typecheck:
	docker compose -f docker-compose.dev.yml exec app yarn tsc --noEmit

build:
	docker compose -f docker-compose.dev.yml exec app yarn build

logs:
	docker compose -f docker-compose.dev.yml logs -f

# Base de données
db-push:
	docker compose -f docker-compose.dev.yml exec app npx prisma db push

db-seed:
	docker compose -f docker-compose.dev.yml exec app npx prisma db seed

db-studio:
	docker compose -f docker-compose.dev.yml exec app npx prisma studio

db-generate:
	docker compose -f docker-compose.dev.yml exec app npx prisma generate

db-reset:
	docker compose -f docker-compose.dev.yml exec app npx prisma db push --force-reset
	docker compose -f docker-compose.dev.yml exec app npx prisma db seed

# Déploiement
upload:
	rsync -avz --exclude='node_modules' --exclude='.next' --exclude='uploads' ./ root@173.212.217.54:~/investiture/

deploy: upload
	ssh root@173.212.217.54 "cd ~/investiture && make prod-build"
