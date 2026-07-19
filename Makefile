.PHONY: dev dev-down dev-build dev-restart \
        prod prod-down prod-build prod-logs prod-seed \
        prod-db-reset  prod-db-push \
        backup-prod rollback-prod migrate-uploads-clear smoke-tests \
        test test-unit test-coverage test-all test-e2e test-e2e-ui lint typecheck build logs \
        db-push db-seed db-studio db-generate db-reset \
        upload deploy download-uploads download-db

SERVER=root@173.212.217.54
BACKUP_DIR=backups
TS=$(shell date +%Y%m%d-%H%M%S)

# ============================================================
#  Developpement
# ============================================================
dev:
	docker compose -f docker-compose.dev.yml up -d

dev-build:
	docker compose -f docker-compose.dev.yml up --build -d

dev-down:
	docker compose -f docker-compose.dev.yml down

dev-restart:
	docker compose -f docker-compose.dev.yml down && docker compose -f docker-compose.dev.yml up -d

# ============================================================
#  Production
# ============================================================
prod:
	docker compose up -d

prod-build:
	docker compose down && docker compose up --build -d

prod-down:
	docker compose down

prod-logs:
	docker compose logs -f

prod-seed:
	docker exec badge-app yarn tsx prisma/seed.ts

prod-db-push:
	docker exec badge-app npx --yes prisma db push

# Ancien reset v1 (conserve pour compatibilite, deconseille en v2)
prod-db-reset:
	@echo "WARNING: This will ERASE all production data!"
	@read -p "Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ] || (echo "Cancelled." && exit 1)
	docker exec badge-app npx --yes prisma db push --force-reset
	docker exec badge-app yarn tsx prisma/seed.ts
	@echo "Production database reset and seeded."

# ============================================================
#  Reset & deploiement v2 (procedure dediee)
# ============================================================

# Backup integral (dump SQL + tar uploads) avant tout reset destructif.
backup-prod:
	@mkdir -p $(BACKUP_DIR)
	@echo "Dump MySQL en cours..."
	docker exec badge-db sh -c 'mysqldump -u root -p"$$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers badge' > $(BACKUP_DIR)/badge-$(TS).sql
	@echo "Archive des uploads en cours..."
	docker run --rm -v badge_uploads_data:/data -v $(PWD)/$(BACKUP_DIR):/backup alpine tar -czf /backup/uploads-$(TS).tar.gz -C /data .
	@echo "Backup termine: $(BACKUP_DIR)/badge-$(TS).sql + $(BACKUP_DIR)/uploads-$(TS).tar.gz"

# Vide le volume uploads en production.
migrate-uploads-clear:
	@echo "WARNING: This will DELETE every file in uploads_data!"
	@read -p "Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ] || (echo "Cancelled." && exit 1)
	docker exec badge-app sh -c 'rm -rf /app/uploads/* /app/uploads/.[!.]* 2>/dev/null; true'
	@echo "Uploads cleared."

# Reset complet v2 : drop+create DB, vide uploads, push schema, seed SUPER_ADMIN.
# Ne pas confondre avec backup-prod : ce dernier doit etre execute AVANT.


# Smoke tests post-deploiement.
smoke-tests:
	docker exec badge-app yarn tsx scripts/smoke-tests.ts

# Restauration depuis le dernier backup (interactif).
# Usage: make rollback-prod SQL=backups/badge-XXXX.sql UPLOADS=backups/uploads-XXXX.tar.gz
rollback-prod:
	@if [ -z "$(SQL)" ] || [ -z "$(UPLOADS)" ]; then \
	  echo "Usage: make rollback-prod SQL=<path.sql> UPLOADS=<path.tar.gz>"; \
	  exit 1; \
	fi
	@echo "WARNING: Rollback va ECRASER la base et les uploads actuels !"
	@read -p "Type 'rollback' to confirm: " confirm && [ "$$confirm" = "rollback" ] || (echo "Cancelled." && exit 1)
	docker exec badge-db sh -c 'mysql -u root -p"$$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS badge; CREATE DATABASE badge;"'
	docker exec -i badge-db sh -c 'mysql -u root -p"$$MYSQL_ROOT_PASSWORD" badge' < $(SQL)
	docker exec badge-app sh -c 'rm -rf /app/uploads/* /app/uploads/.[!.]* 2>/dev/null; true'
	docker run --rm -v badge_uploads_data:/data -v $(PWD)/$(UPLOADS):/backup.tar.gz alpine sh -c 'tar -xzf /backup.tar.gz -C /data'
	@echo "Rollback termine. Verifier l'application."

# ============================================================
#  Commandes dans le conteneur dev
# ============================================================
test:
	docker compose -f docker-compose.dev.yml exec app yarn vitest run

# Tests unitaires cibles sur la logique metier de src/lib (sous-ensemble de `test`).
test-unit:
	docker compose -f docker-compose.dev.yml exec app yarn vitest run src/lib

# Suite Vitest complete avec rapport de couverture V8 (seuils 100% = gate, cf. vitest.config.ts).
test-coverage:
	docker compose -f docker-compose.dev.yml exec app yarn vitest run --coverage

# Chaine de verification complete : s'arrete au premier echec (ordre des prerequis).
# NB : `test` vide la base dev -> relancer `make db-seed` ensuite pour l'app manuelle.
# Les tests e2e seedent leurs propres fixtures (e2e/helpers/db.ts), non impactes par le vidage.
test-all: lint typecheck test test-e2e
	@echo "OK : lint + typecheck + vitest + e2e passes."

test-e2e:
	@echo "Playwright tests s'executent dans le container app (chromium Alpine systeme) contre http://localhost:3000."
	@echo "Pre-requis : make dev demarre. Premiere fois : 'docker compose -f docker-compose.dev.yml exec --user root app apk add --no-cache chromium nss freetype ttf-freefont harfbuzz ca-certificates' (deja fait pour v2-11)."
	docker compose -f docker-compose.dev.yml exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium-browser app yarn playwright test

# Mode UI Playwright (debug visuel, fenetre Electron native). S'execute sur
# l'hote macOS, pas dans le container : il faut un display. Pre-requis :
#   - make dev demarre (l'app doit etre joignable sur localhost:3785)
#   - yarn install (cote hote)
#   - yarn playwright install chromium (telecharge le binaire local, une seule fois)
# Sans PLAYWRIGHT_CHROMIUM_EXECUTABLE, Playwright utilise son chromium integre.
# Les helpers e2e (db.ts, mailpit.ts) tournent dans le process Node de l'hote :
# ils doivent viser les ports exposes sur localhost, pas les hostnames internes
# du reseau Docker (mysql, mailpit) qui ne resolvent que dans les containers.
test-e2e-ui:
	@echo "Lancement de Playwright en mode UI depuis l'hote (fenetre Electron)."
	@echo "L'app dev doit tourner sur localhost:3785 (make dev)."
	DATABASE_URL="mysql://root:password@localhost:33060/badge" \
	MAILPIT_URL="http://localhost:8025" \
	PLAYWRIGHT_BASE_URL=http://localhost:3785 yarn playwright test --ui

validate-badge-templates:
	docker compose -f docker-compose.dev.yml exec app yarn tsx scripts/validate-badge-templates.ts

lint:
	docker compose -f docker-compose.dev.yml exec app yarn lint

typecheck:
	docker compose -f docker-compose.dev.yml exec app yarn tsc --noEmit

build:
	docker compose -f docker-compose.dev.yml exec app yarn build

logs:
	docker compose -f docker-compose.dev.yml logs -f

# ============================================================
#  Base de donnees (dev)
# ============================================================
db-push:
	docker compose -f docker-compose.dev.yml exec app npx prisma db push

db-seed:
	docker compose -f docker-compose.dev.yml exec app npx prisma db seed

# ADR 2026-06-01 (v2-14 Task 15) : seed de demonstration complet (10 orgs,
# 30 events, 200 participants). NE PAS executer en production (le smoke test
# "0 org / 0 event" echouera). Reserve au dev local.
db-seed-demo:
	docker compose -f docker-compose.dev.yml exec -e SEED_MODE=demo app npx prisma db seed

db-studio:
	docker compose -f docker-compose.dev.yml exec app npx prisma studio

db-generate:
	docker compose -f docker-compose.dev.yml exec app npx prisma generate

db-reset:
	docker compose -f docker-compose.dev.yml exec app npx prisma db push --force-reset
	docker compose -f docker-compose.dev.yml exec app npx prisma db seed

# ============================================================
#  Deploiement
# ============================================================
upload:
	rsync -avz --exclude='node_modules' --exclude='.next' --exclude='uploads' --exclude='backups' ./ $(SERVER):~/badge/

deploy: upload
	ssh $(SERVER) "cd ~/badge && make prod-build && make prod-db-push"

download-uploads:
	@mkdir -p uploads
	ssh $(SERVER) "docker cp badge-app:/app/uploads /tmp/badge-uploads"
	rsync -avz $(SERVER):/tmp/badge-uploads/ ./uploads/
	ssh $(SERVER) "rm -rf /tmp/badge-uploads"
	@echo "Uploads telecharges dans ./uploads/"

download-db:
	@mkdir -p backups
	ssh $(SERVER) 'docker exec badge-db sh -c "mysqldump -u root -p\$$MYSQL_ROOT_PASSWORD badge"' > backups/badge-$(TS).sql
	@echo "Dump sauvegarde dans ./backups/"
