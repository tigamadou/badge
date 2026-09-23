.PHONY: dev dev-down dev-build dev-restart \
        dev-https dev-https-hosts dev-https-trust dev-https-check dev-https-untrust \
        prod prod-down prod-build prod-logs \
        prod-db-reset  prod-db-push \
        preprod preprod-down preprod-build preprod-logs preprod-db-push \
        preprod-db-reset \
        backup-prod rollback-prod migrate-uploads-clear smoke-tests smoke-tests-preprod \
        test test-unit test-coverage test-all test-e2e test-e2e-ui lint typecheck build logs \
        db-push db-seed db-studio db-generate db-reset \
        validate-badge-templates migrate-badge-template-refs migrate-installed-templates \
        pack-badge-template sync-engine \
        upload deploy upload-prod deploy-prod upload-preprod deploy-preprod \
        upload-prod-dry upload-preprod-dry net-create \
        download-uploads download-db

SERVER=root@173.212.217.54
BACKUP_DIR=backups
TS=$(shell date +%Y%m%d-%H%M%S)

# Arborescence sur le serveur : une stack par dossier, chacune avec son propre
# checkout du depot et son propre fichier d'environnement.
PROD_DIR=~/prod/badge
PREPROD_DIR=~/preprod/badge

PREPROD_COMPOSE=docker compose -f docker-compose.preprod.yml

# Reseau partage entre les deux stacks : le Caddy de prod y joint les
# conteneurs preprod. Declare `external` dans les deux compose, donc il doit
# exister avant tout `up`. Idempotent.
NET=badge_web

net-create:
	@docker network inspect $(NET) >/dev/null 2>&1 || docker network create $(NET)
	@echo "Reseau $(NET) pret."

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
# `--build` systematique : l'image doit toujours refleter le code du dossier
# (Dockerfile multi-stage -> `yarn build` + runner standalone `node server.js`).
# Sans lui, `up -d` relance silencieusement l'image precedente.
prod: net-create
	docker compose up -d --build

prod-build: net-create
	docker compose down && docker compose up --build -d

prod-down:
	docker compose down

prod-logs:
	docker compose logs -f

# Pas de cible de seed en production : le seed est reserve au developpement
# (`make db-seed`). Les donnees prod/preprod proviennent de l'usage reel ou
# d'une restauration (`make rollback-prod`).

# `prisma` est installe globalement dans l'image runner (cf. Dockerfile).
prod-db-push:
	docker exec badge-app prisma db push

# Ancien reset v1 (conserve pour compatibilite, deconseille en v2)
prod-db-reset:
	@echo "WARNING: This will ERASE all production data!"
	@read -p "Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ] || (echo "Cancelled." && exit 1)
	docker exec badge-app prisma db push --force-reset
	@echo "Production database reset (schema vide, aucun seed)."

# ============================================================
#  Preproduction (a executer dans ~/preprod/badge sur le serveur)
# ============================================================
preprod: net-create
	$(PREPROD_COMPOSE) up -d --build

preprod-build: net-create
	$(PREPROD_COMPOSE) down && $(PREPROD_COMPOSE) up --build -d

preprod-down:
	$(PREPROD_COMPOSE) down

preprod-logs:
	$(PREPROD_COMPOSE) logs -f

preprod-db-push:
	docker exec badge-app-preprod prisma db push

# Reset destructif limite a la preprod : n'affecte jamais les volumes de prod
# (projet compose `badge-preprod`, volumes suffixes `_preprod`).
preprod-db-reset:
	@echo "WARNING: This will ERASE all PREPROD data (not production)."
	@read -p "Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ] || (echo "Cancelled." && exit 1)
	docker exec badge-app-preprod prisma db push --force-reset
	@echo "Preprod database reset (schema vide, aucun seed)."

# ============================================================
#  Caddy
# ============================================================
# Validation hors ligne : syntaxe + coherence de la config. N'a besoin d'aucun
# conteneur en cours. Ne verifie PAS que les upstreams existent (caddy validate
# ne resout pas le DNS) -> enchainer avec caddy-check apres demarrage.
caddy-validate:
	docker run --rm -v $(PWD)/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2-alpine \
	  caddy validate --config /etc/caddy/Caddyfile

# Signale les ecarts de formatage sans modifier le fichier.
caddy-fmt:
	docker run --rm -v $(PWD)/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2-alpine \
	  caddy fmt --diff /etc/caddy/Caddyfile

# Applique la config au Caddy en cours, sans coupure de service et sans
# redemarrer le conteneur. Echoue sans rien casser si la config est invalide.
caddy-reload:
	docker exec badge-caddy caddy reload --config /etc/caddy/Caddyfile

# Verifie que Caddy joint reellement chaque upstream (resolution DNS + port),
# depuis l'interieur du conteneur. A lancer sur le serveur, stacks demarrees.
caddy-check:
	@for up in badge-app:3000 badge-pma:80 badge-minio:9001 \
	           badge-app-preprod:3000 badge-pma-preprod:80 badge-minio-preprod:9001; do \
	  if docker exec badge-caddy wget -q -T3 -O /dev/null "http://$$up" 2>/dev/null; then \
	    echo "OK   $$up"; \
	  else \
	    echo "FAIL $$up"; \
	  fi; \
	done

# Erreurs et problemes de certificat uniquement.
caddy-logs:
	docker logs --tail 200 badge-caddy 2>&1 | grep -iE "error|warn|certificate|acme" || echo "Aucune erreur recente."

# ============================================================
#  HTTPS local (dev)
# ============================================================
# Caddy dev signe les certificats *.badge.local avec sa propre CA (`tls internal`,
# cf. Caddyfile.dev). Rien a generer donc : il suffit de resoudre les domaines
# vers 127.0.0.1 et de faire confiance a la racine de cette CA.
#
# Les domaines sont lus dans Caddyfile.dev plutot qu'ecrits en dur : ajouter un
# site au proxy suffit a le prendre en compte ici.
DEV_DOMAINS=$(shell grep -oE '^[A-Za-z0-9.-]+\.local' Caddyfile.dev | sort -u)
CADDY_ROOT_CRT=.caddy-root.crt

dev-https: dev-https-hosts dev-https-trust
	@echo ""
	@echo "HTTPS local pret. Verifier avec : make dev-https-check"
	@echo "Firefox utilise son propre magasin de certificats : importer la racine"
	@echo "via Parametres > Vie privee et securite > Certificats si besoin."
	@if [ -f .env ] && grep -q '^NEXTAUTH_URL=' .env && ! grep -q '^NEXTAUTH_URL=https://badge.local' .env; then \
	  echo ""; \
	  echo "ATTENTION : le .env racine surcharge docker/compose.dev.env et ne pointe pas"; \
	  echo "vers https://badge.local. Les liens d'email et les callbacks NextAuth seront"; \
	  echo "incoherents tant que la valeur n'est pas alignee."; \
	fi

# Ajoute a /etc/hosts les seuls domaines manquants (idempotent, sudo requis).
dev-https-hosts:
	@missing=""; \
	for d in $(DEV_DOMAINS); do \
	  grep -qE "^[^#]*[[:space:]]$$d([[:space:]]|\$$)" /etc/hosts || missing="$$missing $$d"; \
	done; \
	if [ -z "$$missing" ]; then \
	  echo "/etc/hosts : deja a jour ($(DEV_DOMAINS))."; \
	else \
	  echo "Ajout a /etc/hosts (mot de passe admin requis) :$$missing"; \
	  echo "127.0.0.1$$missing" | sudo tee -a /etc/hosts >/dev/null; \
	fi

# Extrait la racine de la CA Caddy et l'installe dans le magasin systeme.
dev-https-trust:
	@rm -f $(CADDY_ROOT_CRT)
	@i=0; \
	until docker compose -f docker-compose.dev.yml cp \
	    caddy:/data/caddy/pki/authorities/local/root.crt $(CADDY_ROOT_CRT) >/dev/null 2>&1; do \
	  i=$$((i+1)); \
	  if [ $$i -ge 10 ]; then \
	    echo "Erreur : racine CA introuvable dans le conteneur caddy."; \
	    echo "Verifier que la stack dev tourne ('make dev') puis relancer."; \
	    exit 1; \
	  fi; \
	  sleep 1; \
	done
	@fp=$$(openssl x509 -in $(CADDY_ROOT_CRT) -noout -fingerprint -sha1 | cut -d= -f2 | tr -d ':' | tr 'a-z' 'A-Z'); \
	case "$$(uname -s)" in \
	  Darwin) \
	    if security find-certificate -a -Z /Library/Keychains/System.keychain 2>/dev/null | grep -q "$$fp"; then \
	      echo "CA Caddy deja approuvee dans le trousseau Systeme ($$fp)."; \
	    else \
	      echo "Ajout de la CA Caddy au trousseau Systeme (mot de passe admin requis)..."; \
	      sudo security add-trusted-cert -d -r trustRoot \
	        -k /Library/Keychains/System.keychain $(CADDY_ROOT_CRT); \
	    fi ;; \
	  Linux) \
	    echo "Installation de la CA Caddy dans /usr/local/share/ca-certificates (sudo requis)..."; \
	    sudo cp $(CADDY_ROOT_CRT) /usr/local/share/ca-certificates/caddy-badge-local.crt; \
	    sudo update-ca-certificates ;; \
	  *) \
	    echo "OS non gere ($$(uname -s)) : approuver manuellement $(CADDY_ROOT_CRT)."; \
	    exit 1 ;; \
	esac; \
	rm -f $(CADDY_ROOT_CRT)

# Verifie la redirection HTTP -> HTTPS et la validite de la chaine SANS -k :
# un echec ici signifie que la CA n'est pas (ou plus) approuvee.
dev-https-check:
	@for d in $(DEV_DOMAINS); do \
	  http=$$(curl -sS -o /dev/null -w "%{http_code}" "http://$$d/" 2>/dev/null || true); \
	  https=$$(curl -sS -o /dev/null -w "%{http_code}" "https://$$d/" 2>/dev/null || true); \
	  if [ "$$https" = "000" ]; then \
	    echo "KO   $$d (http=$$http) : certificat refuse ou domaine non resolu"; \
	  else \
	    echo "OK   $$d (http=$$http -> https=$$https)"; \
	  fi; \
	done

# Retire la CA du magasin systeme (utile apres un `down -v` qui regenere la CA :
# l'ancienne racine devient obsolete et encombre le trousseau).
dev-https-untrust:
	@case "$$(uname -s)" in \
	  Darwin) \
	    hashes=$$(security find-certificate -a -Z /Library/Keychains/System.keychain 2>/dev/null \
	      | awk '/^SHA-1 hash: /{h=$$3} /"labl"<blob>=".*Caddy Local Authority/{print h}'); \
	    if [ -z "$$hashes" ]; then \
	      echo "Aucune CA Caddy dans le trousseau Systeme."; \
	    else \
	      for h in $$hashes; do \
	        echo "Suppression de la CA Caddy $$h (mot de passe admin requis)..."; \
	        sudo security delete-certificate -Z "$$h" -t /Library/Keychains/System.keychain; \
	      done; \
	    fi ;; \
	  Linux) \
	    sudo rm -f /usr/local/share/ca-certificates/caddy-badge-local.crt; \
	    sudo update-ca-certificates --fresh ;; \
	  *) echo "OS non gere ($$(uname -s))." ;; \
	esac

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

# Smoke tests post-deploiement (scripts/ absent du runner : service `tools`).
smoke-tests:
	docker compose run --rm tools yarn tsx scripts/smoke-tests.ts

smoke-tests-preprod:
	$(PREPROD_COMPOSE) run --rm tools yarn tsx scripts/smoke-tests.ts

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
	@echo "Cible https://badge.local (via Caddy) : requiert /etc/hosts (127.0.0.1 badge.local)"
	@echo "et la CA Caddy de confiance (ou ignoreHTTPSErrors, deja actif dans la config)."
	DATABASE_URL="mysql://root:password@localhost:33060/badge" \
	MAILPIT_URL="http://localhost:8025" \
	PLAYWRIGHT_VIDEO=on \
	PLAYWRIGHT_BASE_URL=https://badge.local yarn playwright test --ui

validate-badge-templates:
	docker compose -f docker-compose.dev.yml exec app yarn tsx scripts/validate-badge-templates.ts

# Migre les templates installes du format v1 vers le v2 (dry-run par defaut,
# ARGS=--apply pour ecrire). Le moteur v2 ne sait pas rendre une ligne restee en v1.
migrate-installed-templates:
	docker compose -f docker-compose.dev.yml exec app yarn tsx scripts/migrate-installed-templates-v2.ts $(ARGS)

# v4 (plan 12) : convertit les anciennes references texte ("default-v1") vers les cuid
# des templates installes. Idempotent. Utile sur une base de dev anterieure au plan 12 ;
# une base neuve est deja correcte apres `make db-seed`.
migrate-badge-template-refs:
	docker compose -f docker-compose.dev.yml exec app yarn tsx scripts/migrate-badge-template-refs.ts

# v4 (spec 14) : empaquette badge-templates/<NAME>/ en archive installable. Valide le
# manifeste avant d'ecrire : mieux vaut echouer ici qu'au televersement.
pack-badge-template:
	docker compose -f docker-compose.dev.yml exec -e NAME=$(NAME) app yarn tsx scripts/pack-badge-template.ts

# Resynchronise le moteur declaratif depuis pdfStudio (voir engine/SOURCE.md).
sync-engine:
	npx tsx scripts/sync-engine.ts --from ../pdfStudio

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
# Le client Prisma est genere DEUX fois : dans le conteneur (execution) et sur l'hote
# (types lus par l'editeur). Sans la seconde, l'IDE ignore tout modele ajoute et signale
# « Property 'x' does not exist on type 'PrismaClient' » alors que `make typecheck` passe.
# La generation hote est silencieuse et non bloquante : elle echoue sans casser la cible
# si les node_modules de l'hote sont absents (installation 100% conteneur).
db-push:
	docker compose -f docker-compose.dev.yml exec app npx prisma db push
	@./node_modules/.bin/prisma generate >/dev/null 2>&1 && echo "Client Prisma regenere aussi sur l'hote (types IDE)." || true

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
	@./node_modules/.bin/prisma generate >/dev/null 2>&1 && echo "Client Prisma regenere aussi sur l'hote (types IDE)." || true

db-reset:
	docker compose -f docker-compose.dev.yml exec app npx prisma db push --force-reset
	docker compose -f docker-compose.dev.yml exec app npx prisma db seed

# ============================================================
#  Deploiement
# ============================================================
# `./` inclut les fichiers caches (.env.*, .yarnrc.yml, .pnp.cjs, .yarn/) :
# tout le projet part, sauf ce qui est regenere par le build ou appartient au
# serveur. --delete aligne exactement le dossier distant sur le projet local ;
# les chemins exclus ci-dessous sont proteges par rsync et ne sont jamais
# supprimes cote serveur (uploads et backups de production notamment).
# `/.env` (racine uniquement) est l'environnement de dev local : Compose le lit
# automatiquement pour l'interpolation et il n'a rien a faire sur le serveur.
RSYNC_EXCLUDES=--exclude='node_modules' --exclude='.next' --exclude='uploads' \
               --exclude='backups' --exclude='.git' --exclude='coverage' \
               --exclude='*.zip' --exclude='/.env' --exclude='.DS_Store'

RSYNC=rsync -avz --delete $(RSYNC_EXCLUDES)

# Chaque stack recoit uniquement son propre fichier d'environnement : le
# .env.production ne doit jamais atterrir dans ~/preprod/badge et inversement.
upload-prod:
	ssh $(SERVER) "mkdir -p $(PROD_DIR)"
	$(RSYNC) --exclude='.env.preprod' ./ $(SERVER):$(PROD_DIR)/

deploy-prod: upload-prod
	ssh $(SERVER) "cd $(PROD_DIR) && make prod-build && make prod-db-push"

upload-preprod:
	ssh $(SERVER) "mkdir -p $(PREPROD_DIR)"
	$(RSYNC) --exclude='.env.production' ./ $(SERVER):$(PREPROD_DIR)/

deploy-preprod: upload-preprod
	ssh $(SERVER) "cd $(PREPROD_DIR) && make preprod-build && make preprod-db-push"

# Simulation : affiche ce qui serait transfere et supprime, sans rien modifier.
# A lancer avant le premier deploiement sur un dossier existant.
upload-prod-dry:
	$(RSYNC) --dry-run --exclude='.env.preprod' ./ $(SERVER):$(PROD_DIR)/

upload-preprod-dry:
	$(RSYNC) --dry-run --exclude='.env.production' ./ $(SERVER):$(PREPROD_DIR)/

# Alias historiques (cibles la production).
upload: upload-prod
deploy: deploy-prod

download-uploads:
	@mkdir -p uploads
	ssh $(SERVER) "docker cp badge-app:/app/uploads /tmp/badge-uploads"
	rsync -avz $(SERVER):/tmp/badge-uploads/ ./backups/uploads/
	ssh $(SERVER) "rm -rf /tmp/badge-uploads"
	@echo "Uploads telecharges dans ./uploads/"

download-db:
	@mkdir -p backups/db
	ssh $(SERVER) 'docker exec badge-db sh -c "mysqldump -u root -p\$$MYSQL_ROOT_PASSWORD badge"' > backups/db/badge-$(TS).sql
	@echo "Dump sauvegarde dans ./backups/"
