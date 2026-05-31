# Reset & déploiement initial — Implementation Plan

> **Mise a jour 2026-05-31 — decision SMTP plateforme uniquement** : les variables `PLATFORM_SMTP_*` deviennent la **seule** source SMTP de la plateforme. Aucun fallback ni override possible cote `OrgSettings` ou `EventSettings` : tous les emails (inscription, confirmation, rejet, invitations staff, tests SMTP) partent via le SMTP plateforme et avec `PLATFORM_SMTP_FROM` comme expediteur. Le seed `PlatformSettings` reste inchange (il continue d'inclure tous les champs SMTP), mais le tableau des variables critiques (section ci-dessous) est mis a jour pour refleter cette decision.

## Progression

> **Convention** : avant chaque session, lire ce bloc pour reprendre la ou on s'etait arrete. Apres chaque task validee (tests verts + criteres d'acceptation OK), passer `[ ]` a `[x]` et dater. En cas d'interruption mi-task, passer a `[~]`, dater, et noter precisement l'etat (step en cours, fichiers touches, prochaine etape). Si une task est abandonnee : passer a `[-]` avec la raison dans les notes.

Legende statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned.

| Task | Statut | Date | Notes |
|------|--------|------|-------|
| 0 | [ ] | -- | -- |
| 1 | [ ] | -- | -- |
| 2 | [ ] | -- | -- |
| 3 | [ ] | -- | -- |
| 4 | [ ] | -- | -- |
| 5 | [ ] | -- | -- |
| 6 | [ ] | -- | -- |
| 7 | [ ] | -- | -- |

**Derniere session** : aucune, plan jamais commence.
**Prochaine etape** : Task 1.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Préparer les outils, scripts et procédures permettant de réinitialiser entièrement la base et les uploads en production puis d'y redéployer Badge v2 avec smoke tests et plan de rollback.

**Architecture:** Aucun changement de code applicatif. On ajoute des cibles Makefile (`backup-prod`, `prod-db-reset-v2`, `smoke-tests`, `migrate-uploads-clear`, `rollback-prod`), un script TypeScript de smoke tests (`scripts/smoke-tests.ts`) exécuté via tsx dans le conteneur app, et la procédure documentée dans `docs/v2/installation.md`. Le seed v2 et le schéma Prisma v2 sont déjà livrés par Plan 1 ; ce plan se concentre sur l'outillage prod et les variables d'environnement v2.

**Tech Stack:** GNU Make, Bash, Docker Compose 2, MySQL 8 (`mysqldump`), tsx, Vitest 4, Prisma 6, NextAuth 4, fetch natif Node 20.

**Spec:** [docs/v2/features/deploiement-initial.md](../../v2/features/deploiement-initial.md)

---

## File Structure

**Files to create:**

- `scripts/smoke-tests.ts` — suite minimale de vérifications post-déploiement
- `scripts/__tests__/smoke-tests.test.ts` — tests unitaires des assertions du script
- `.env.production.example` — modèle complet des variables v2 pour la prod
- `docs/v2/installation.md` — procédure de reset + redéploiement + rollback

**Files to modify:**

- `Makefile` — ajout des cibles `backup-prod`, `prod-db-reset-v2`, `smoke-tests`, `migrate-uploads-clear`, `rollback-prod` ; mise à jour de `prod-seed`
- `.gitignore` — exclure `backups/`, `.env.production`

**Files removed:** aucun.

**Tests will live in `scripts/__tests__/` (extension de la convention `src/lib/__tests__/`) car le script n'est pas dans `src/lib/`.**

---

## Pre-flight

### Task 0: Vérifier l'état du dépôt

- [ ] **Step 0.1: Confirmer la branche et l'état**

Run: `git status && git branch --show-current`

Expected: `On branch feat/v2-sass`, working tree clean.

- [ ] **Step 0.2: Vérifier que Plan 1 est appliqué**

```bash
docker compose -f docker-compose.dev.yml exec app sh -c "test -f prisma/seed.ts && grep -q STAFF_ADMIN prisma/seed.ts && echo OK"
```

Expected: `OK`. Si absent, exécuter Plan 1 avant ce plan.

- [ ] **Step 0.3: Vérifier que les conteneurs dev tournent**

Run: `docker compose -f docker-compose.dev.yml ps`

Expected: services `app`, `mysql`, `mailpit`, `phpmyadmin` en `running`. Sinon : `make dev`.

---

## Task 1: Variables d'environnement v2 (`.env.production.example`)

**Files:**

- Create: `.env.production.example`
- Modify: `.gitignore`

> Ce fichier sert de modèle versionné. Le `.env.production` réel (non versionné) sera créé manuellement le jour du déploiement à partir de cet exemple.

- [ ] **Step 1.1: Créer `.env.production.example`**

Écraser le fichier (créer s'il n'existe pas) avec le contenu suivant :

```
# ============================================================
#  Badge v2 — .env.production.example
#  Copier ce fichier en .env.production et remplir les valeurs.
#  Ne jamais committer .env.production (cf .gitignore).
# ============================================================

# --- Base de données ---
DATABASE_URL=mysql://root:CHANGE_ME@mysql:3306/badge
MYSQL_ROOT_PASSWORD=CHANGE_ME

# --- NextAuth ---
NEXTAUTH_SECRET=CHANGE_ME_openssl_rand_base64_32
NEXTAUTH_URL=https://badge.exemple.tld
BASE_URL=https://badge.exemple.tld

# --- SMTP plateforme (fallback global) ---
PLATFORM_SMTP_HOST=smtp.exemple.tld
PLATFORM_SMTP_PORT=587
PLATFORM_SMTP_FROM=noreply@badge.exemple.tld
PLATFORM_SMTP_USER=noreply@badge.exemple.tld
PLATFORM_SMTP_PASSWORD=CHANGE_ME
PLATFORM_SMTP_SECURE=false

# --- Seed staff initial (a changer apres le premier login) ---
SEED_STAFF_EMAIL=admin@badge.exemple.tld
SEED_STAFF_PASSWORD=CHANGE_ME_temporary

# --- reCAPTCHA (optionnel, fallback plateforme) ---
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
```

- [ ] **Step 1.2: Mettre à jour `.gitignore`**

Vérifier la présence (ajouter si manquant) des lignes suivantes à la fin du fichier :

```
# Badge v2 - secrets et backups
.env
.env.production
.env.local
backups/
```

Commande de vérification :

```bash
grep -q "^backups/$" .gitignore && grep -q "^\.env\.production$" .gitignore && echo OK
```

Expected: `OK`.

- [ ] **Step 1.3: Vérifier qu'aucun secret n'est traqué**

```bash
git ls-files | grep -E "^\.env(\.|$)" | grep -v ".example"
```

Expected: aucune sortie (aucun `.env*` non-example dans Git).

- [ ] **Step 1.4: Commit**

```bash
git add .env.production.example .gitignore
git commit -m "feat(v2): modele .env.production v2 et gitignore backups"
```

---

## Task 2: Refonte du `Makefile` (cibles déploiement v2)

**Files:**

- Modify: `Makefile`

> On conserve les cibles dev existantes et on ajoute / remplace les cibles prod pour la procédure v2.

- [ ] **Step 2.1: Réécrire `Makefile`**

Remplacer intégralement le contenu du fichier `Makefile` par :

```makefile
.PHONY: dev dev-down dev-build dev-restart \
        prod prod-down prod-build prod-logs prod-seed \
        prod-db-reset prod-db-reset-v2 prod-db-push \
        backup-prod rollback-prod migrate-uploads-clear smoke-tests \
        test lint typecheck build logs \
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

# Reset complet v2 : drop+create DB, vide uploads, push schema, seed STAFF_ADMIN.
# Ne pas confondre avec backup-prod : ce dernier doit etre execute AVANT.
prod-db-reset-v2:
	@echo "WARNING: This will ERASE the v1 production database and uploads!"
	@echo "Have you run 'make backup-prod' ? (recommended)"
	@read -p "Type 'reset-v2' to confirm: " confirm && [ "$$confirm" = "reset-v2" ] || (echo "Cancelled." && exit 1)
	docker exec badge-db sh -c 'mysql -u root -p"$$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS badge; CREATE DATABASE badge;"'
	docker exec badge-app sh -c 'rm -rf /app/uploads/* /app/uploads/.[!.]* 2>/dev/null; true'
	docker exec badge-app npx --yes prisma db push
	docker exec badge-app npx --yes prisma generate
	docker exec badge-app yarn tsx prisma/seed.ts
	@echo "Production database v2 reset and seeded."

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
```

> Choix simples documentés :
>
> - Le nom du volume Docker pour les uploads est `badge_uploads_data` (préfixé par le nom du projet Compose `badge`). Si la stack tourne sous un autre nom, adapter dans `backup-prod` et `rollback-prod`.
> - `backup-prod` génère deux fichiers horodatés (un SQL, un tar.gz uploads). Le `rollback-prod` demande explicitement les chemins pour éviter toute restauration accidentelle.
> - `prod-db-reset-v2` exige le mot de confirmation `reset-v2` (distinct de `yes`) pour réduire le risque de déclenchement par habitude.

- [ ] **Step 2.2: Vérifier que `make help` (sans cible) liste bien les nouvelles cibles**

```bash
make -n backup-prod 2>&1 | head -3
```

Expected: la commande affiche les premières lignes du shell qui serait exécuté, sans erreur "No rule to make target".

- [ ] **Step 2.3: Commit**

```bash
git add Makefile
git commit -m "feat(v2): cibles Makefile pour reset prod v2 (backup, reset, smoke, rollback)"
```

---

## Task 3: Script de smoke tests (`scripts/smoke-tests.ts`)

**Files:**

- Create: `scripts/smoke-tests.ts`
- Create: `scripts/__tests__/smoke-tests.test.ts`

> Le script est exécuté via `tsx` dans le conteneur `badge-app` (cf cible `smoke-tests` du Makefile). Il utilise `BASE_URL` pour cibler l'application HTTP locale du conteneur, et la même `DATABASE_URL` que l'app pour Prisma.

- [ ] **Step 3.1: Écrire le test unitaire de la fonction d'assertion**

Créer `scripts/__tests__/smoke-tests.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { assert, SmokeError } from "../smoke-tests";

describe("smoke-tests helpers", () => {
  it("assert ne jette pas quand la condition est vraie", () => {
    expect(() => assert(true, "ok")).not.toThrow();
  });

  it("assert jette SmokeError quand la condition est fausse", () => {
    expect(() => assert(false, "boom")).toThrow(SmokeError);
    try {
      assert(false, "boom");
    } catch (e) {
      expect(e).toBeInstanceOf(SmokeError);
      expect((e as Error).message).toBe("boom");
    }
  });
});
```

- [ ] **Step 3.2: Lancer le test pour confirmer l'échec attendu**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run scripts/__tests__/smoke-tests.test.ts
```

Expected: FAIL avec `Cannot find module '../smoke-tests'`.

- [ ] **Step 3.3: Implémenter `scripts/smoke-tests.ts`**

Contenu complet :

```typescript
import { PrismaClient } from "@prisma/client";

export class SmokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmokeError";
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new SmokeError(message);
}

type CheckResult = { name: string; ok: boolean; detail?: string };

async function runChecks(): Promise<CheckResult[]> {
  const prisma = new PrismaClient();
  const results: CheckResult[] = [];

  const record = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, ok: true });
    } catch (e) {
      results.push({
        name,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  };

  await record("DB SELECT 1", async () => {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    assert(Array.isArray(rows) && rows.length === 1, "Pas de reponse SQL");
  });

  await record("PlatformSettings singleton", async () => {
    const ps = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    assert(ps !== null, "PlatformSettings manquant");
  });

  await record("Au moins un staff seede", async () => {
    const staff = await prisma.user.findFirst({ where: { isStaff: true } });
    assert(staff !== null, "Aucun utilisateur staff seede");
  });

  await record("Aucune organisation en base", async () => {
    const count = await prisma.organization.count();
    assert(count === 0, `Attendu 0 Organization, trouve ${count}`);
  });

  await record("Aucun event en base", async () => {
    const count = await prisma.event.count();
    assert(count === 0, `Attendu 0 Event, trouve ${count}`);
  });

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  await record(`HTTP GET ${baseUrl}/login`, async () => {
    const res = await fetch(`${baseUrl}/login`, { redirect: "manual" });
    assert(res.status === 200, `Status ${res.status} (attendu 200)`);
    const body = await res.text();
    assert(body.length > 0, "Body vide");
  });

  await record(`HTTP GET ${baseUrl}/staff sans session`, async () => {
    const res = await fetch(`${baseUrl}/staff`, { redirect: "manual" });
    // NextAuth peut repondre 200 (HTML de redirect cote client) ou 302/307 (server redirect)
    assert(
      [200, 302, 307].includes(res.status),
      `Status ${res.status} inattendu pour /staff non auth`,
    );
  });

  await record(`HTTP GET ${baseUrl}/api/auth/providers`, async () => {
    const res = await fetch(`${baseUrl}/api/auth/providers`);
    assert(res.status === 200, `Status ${res.status} sur /api/auth/providers`);
    const json = (await res.json()) as Record<string, unknown>;
    assert("credentials" in json, "Provider credentials absent");
  });

  await prisma.$disconnect();
  return results;
}

async function main() {
  const results = await runChecks();

  for (const r of results) {
    const tag = r.ok ? "OK" : "FAIL";
    const line = `[${tag}] ${r.name}` + (r.detail ? ` -- ${r.detail}` : "");
    console.log(line);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} smoke test(s) en echec.`);
    process.exit(1);
  }
  console.log(`\nSmoke tests OK (${results.length}/${results.length}).`);
}

// Exécution uniquement quand appelé directement (pas en import test).
const isDirect =
  typeof require !== "undefined" ? require.main === module : false;
if (isDirect || process.argv[1]?.endsWith("smoke-tests.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

> Choix simples documentés :
>
> - Le script *n'arrête pas* à la première erreur : il agrège tous les résultats puis sort en code 1 si au moins un check a échoué. Plus utile pour diagnostiquer en prod.
> - On vérifie aussi `/api/auth/providers` qui est public et permet de valider que NextAuth est correctement initialisé sans nécessiter de session.
> - `BASE_URL` par défaut : `http://localhost:3000` (utile en local). En prod, `BASE_URL` est défini dans `.env.production` et hérité par le conteneur `badge-app`.

- [ ] **Step 3.4: Lancer le test unitaire pour confirmer qu'il passe**

```bash
docker compose -f docker-compose.dev.yml exec app yarn vitest run scripts/__tests__/smoke-tests.test.ts
```

Expected: 2 passed.

- [ ] **Step 3.5: Vérifier que tsx peut exécuter le script (résolution module)**

```bash
docker compose -f docker-compose.dev.yml exec app sh -c 'BASE_URL=http://localhost:3000 yarn tsx scripts/smoke-tests.ts || true'
```

Expected: au moins le bloc DB doit fonctionner (PlatformSettings + staff seedé par Plan 1). Les checks HTTP peuvent échouer si `next dev` n'est pas en marche, ce n'est pas bloquant à ce stade — l'objectif est de vérifier que le script s'exécute sans erreur de syntaxe ni d'import.

- [ ] **Step 3.6: Vérifier que `vitest.config.ts` n'exclut pas `scripts/`**

```bash
docker compose -f docker-compose.dev.yml exec app sh -c 'cat vitest.config.ts'
```

Si le fichier contient un `include` restreint à `src/**` ou un `exclude` qui couvre `scripts/`, ajouter `"scripts/**/*.test.ts"` à `test.include`. Si la configuration est par défaut (pas de `include`), Vitest découvre automatiquement les fichiers `*.test.ts` du dépôt — rien à modifier.

Expected: soit la config par défaut, soit `include` étendu. Documenter le changement dans le commit suivant si applicable.

- [ ] **Step 3.7: Commit**

```bash
git add scripts/smoke-tests.ts scripts/__tests__/smoke-tests.test.ts
git commit -m "feat(v2): script smoke-tests + test unitaire de assert"
```

Si `vitest.config.ts` a dû être modifié à l'étape 3.6, l'ajouter à ce commit.

---

## Task 4: Documentation de la procédure (`docs/v2/installation.md`)

**Files:**

- Create: `docs/v2/installation.md`

> Ce fichier devient la référence opérationnelle pour le déploiement v2 (et les futures mises à jour). Il reprend la spec en y intégrant les nouvelles cibles Makefile et le script `smoke-tests.ts`.

- [ ] **Step 4.1: Écrire `docs/v2/installation.md`**

Contenu complet :

````markdown
# Installation & déploiement v2

> Ce document décrit la procédure de **première installation v2** (incluant la réinitialisation d'une instance v1 existante) et les opérations courantes.
>
> Pour le développement local, voir aussi `docs/v2/architecture.md`.

## 1. Prérequis serveur

- Docker Engine 24+
- Docker Compose v2
- Accès SSH `root@<serveur>` (cf `SERVER=` dans le `Makefile`)
- Domaine pointant vers le serveur (Caddy gère TLS)
- 1 utilisateur staff initial connu (email + mot de passe temporaire)

## 2. Variables d'environnement

Toutes les variables vivent dans `.env.production` (jamais committé). Modèle à copier : `.env.production.example`.

Variables critiques v2 :

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL MySQL pointant vers le conteneur `mysql` |
| `MYSQL_ROOT_PASSWORD` | Mot de passe root MySQL (utilisé aussi par les backups) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` / `BASE_URL` | URL publique HTTPS |
| `PLATFORM_SMTP_*` | SMTP plateforme (source unique, pas d'override possible côté Org/Event) |
| `SEED_STAFF_EMAIL` / `SEED_STAFF_PASSWORD` | Premier STAFF_ADMIN (à changer après login) |

Les anciennes variables `SMTP_*` (v1) et `SEED_ADMIN_*` (v1) **ne sont plus lues**.

## 3. Procédure de reset & déploiement v2 (depuis une instance v1)

Durée estimée : ~15-20 minutes. Effectuer en **fenêtre de maintenance**.

### 3.1 — Préparation locale

```bash
# Sur la machine de dev, sur la branche development (ou tag v2.0.0 une fois mergee)
git checkout development
git pull
make test && make lint && make typecheck
```

### 3.2 — Synchroniser le code sur le serveur

```bash
make upload          # rsync vers ~/badge/ sur le serveur
ssh root@<serveur>   # se connecter
cd ~/badge
```

### 3.3 — Backup de précaution

```bash
make backup-prod
ls -lh backups/
# Attendu : badge-<timestamp>.sql + uploads-<timestamp>.tar.gz
```

Conserver ces deux fichiers au moins **30 jours**. Les copier hors du serveur si possible (`scp backups/* user@machine-dev:.../badge/backups/`).

### 3.4 — Mettre à jour `.env.production`

Comparer avec `.env.production.example` et ajouter les nouvelles clés v2 (`PLATFORM_SMTP_*`, `SEED_STAFF_*`). Retirer les clés v1 obsolètes (`SMTP_*`, `SEED_ADMIN_*`).

### 3.5 — Reset BDD + uploads + redéploiement

```bash
make prod-down                  # arret de la stack v1
make prod-build                 # rebuild images avec le code v2
make prod-db-reset-v2           # drop+create DB + vide uploads + push schema + seed
```

> `prod-db-reset-v2` demande la confirmation `reset-v2` (et non `yes`) pour eviter tout déclenchement accidentel.

### 3.6 — Smoke tests

```bash
make smoke-tests
```

Sortie attendue :

```
[OK] DB SELECT 1
[OK] PlatformSettings singleton
[OK] Au moins un staff seede
[OK] Aucune organisation en base
[OK] Aucun event en base
[OK] HTTP GET https://<domaine>/login
[OK] HTTP GET https://<domaine>/staff sans session
[OK] HTTP GET https://<domaine>/api/auth/providers

Smoke tests OK (8/8).
```

Si un check échoue → passer à la section **Rollback**.

### 3.7 — Première connexion STAFF_ADMIN

1. Ouvrir `https://<domaine>/login`
2. Email : valeur de `SEED_STAFF_EMAIL`
3. Mot de passe : valeur de `SEED_STAFF_PASSWORD`
4. **Aller dans `/profile` immédiatement** et changer le mot de passe.

### 3.8 — Onboarding initial

Le staff crée la première organisation (`/staff/organizations`) puis assigne un OWNER. Voir `docs/v2/features/espace-staff.md`.

## 4. Plan de rollback

À déclencher si les smoke tests sont rouges ou si l'application ne démarre pas.

### 4.1 — Identifier le backup à restaurer

```bash
ls backups/
# Choisir la paire la plus recente : badge-<TS>.sql et uploads-<TS>.tar.gz
```

### 4.2 — Restaurer

```bash
make rollback-prod \
  SQL=backups/badge-<TS>.sql \
  UPLOADS=backups/uploads-<TS>.tar.gz
```

La commande demande la confirmation `rollback`. Elle :

1. Drop+recrée la base `badge`
2. Importe le dump SQL
3. Vide le volume `uploads_data`
4. Décompresse l'archive uploads

### 4.3 — Repasser sur le code v1

```bash
git checkout v1.x.x         # remplacer par le tag de la derniere v1 stable
make prod-build
make prod
```

### 4.4 — Vérifier

```bash
curl -I https://<domaine>/login
# Attendu : HTTP/2 200
```

Si le site ne répond toujours pas → revenir à la sauvegarde précédente, examiner `make prod-logs`.

## 5. Opérations courantes (post-installation)

### Mises à jour de schéma

Les évolutions Prisma futures passent par `prisma db push` (pas de migration formelle tant que la base est en pré-production). Une fois la v2 stabilisée, **migrer vers `prisma migrate`** et générer une migration baseline.

### Backups réguliers

Programmer un cron sur le serveur :

```bash
# /etc/cron.d/badge-backup
0 3 * * * root cd /root/badge && make backup-prod >> /var/log/badge-backup.log 2>&1
```

Et purger les backups vieux de plus de 30 jours :

```bash
find /root/badge/backups -mtime +30 -type f -delete
```

### Smoke tests réguliers

`make smoke-tests` peut être appelé dans un monitoring (UptimeKuma, Healthchecks.io) via cron toutes les heures.

## 6. Variables sensibles — checklist sécurité

- [ ] `NEXTAUTH_SECRET` généré avec `openssl rand -base64 32` (jamais réutilisé)
- [ ] `MYSQL_ROOT_PASSWORD` ≥ 20 caractères aléatoires
- [ ] `SEED_STAFF_PASSWORD` changé après le premier login
- [ ] `.env.production` jamais committé (vérifier `git ls-files | grep .env.production`)
- [ ] Fichiers `backups/*` exclus de Git (`.gitignore`)
- [ ] Volumes Docker `mysql_data` et `uploads_data` inclus dans le backup système du serveur

## 7. Références

- Spec déploiement initial : `docs/v2/features/deploiement-initial.md`
- Spec multi-tenancy & RBAC : `docs/v2/features/multi-tenancy-rbac.md`
- Architecture v2 : `docs/v2/architecture.md`
- Schéma BDD : `prisma/schema.prisma`
````

- [ ] **Step 4.2: Vérifier l'absence d'avertissement lint markdown**

```bash
ls -1 docs/v2/installation.md && wc -l docs/v2/installation.md
```

Expected: fichier présent, ~150 lignes.

- [ ] **Step 4.3: Commit**

```bash
git add docs/v2/installation.md
git commit -m "docs(v2): procedure installation, reset, smoke tests et rollback"
```

---

## Task 5: Test de la procédure complète en local (dry run)

**Files:** aucun (validation manuelle).

> On rejoue la procédure prod sur l'environnement dev pour valider que les cibles Makefile, le script seed et les smoke tests fonctionnent bout en bout. Aucune commande ne touche la prod.

- [ ] **Step 5.1: Vérifier que `make dev` tourne**

```bash
docker compose -f docker-compose.dev.yml ps
```

Expected: `badge-app` et `badge-db` en `running`. Sinon : `make dev`.

- [ ] **Step 5.2: Sauvegarder l'état dev courant (par précaution)**

```bash
mkdir -p /tmp/badge-dev-precaution
docker exec badge-db sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" badge' > /tmp/badge-dev-precaution/badge.sql
echo "Backup precaution: /tmp/badge-dev-precaution/badge.sql"
```

Expected: fichier SQL non vide (taille > 0).

- [ ] **Step 5.3: Drop + recréer la base dev**

```bash
docker exec badge-db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS badge; CREATE DATABASE badge;"'
```

Expected: aucune erreur.

- [ ] **Step 5.4: Push schema v2**

```bash
docker compose -f docker-compose.dev.yml exec app npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 5.5: Seed**

```bash
docker compose -f docker-compose.dev.yml exec app npx prisma db seed
```

Expected: `STAFF_ADMIN created: admin@badge.local` (ou la valeur de `SEED_STAFF_EMAIL`).

- [ ] **Step 5.6: Lancer les smoke tests**

```bash
docker compose -f docker-compose.dev.yml exec app sh -c 'BASE_URL=http://app:3000 yarn tsx scripts/smoke-tests.ts'
```

> `BASE_URL=http://app:3000` car en dev le serveur Next écoute sur le port 3000 du conteneur `app` ; depuis `app` lui-même, `localhost:3000` fonctionne aussi.

Expected (8 checks OK) :

```
[OK] DB SELECT 1
[OK] PlatformSettings singleton
[OK] Au moins un staff seede
[OK] Aucune organisation en base
[OK] Aucun event en base
[OK] HTTP GET http://app:3000/login
[OK] HTTP GET http://app:3000/staff sans session
[OK] HTTP GET http://app:3000/api/auth/providers

Smoke tests OK (8/8).
```

> Si Next n'est pas démarré (`next dev`), les 3 checks HTTP échouent. Lancer le serveur : `docker compose -f docker-compose.dev.yml exec app yarn dev` dans un autre shell, attendre `Ready in Xms`, puis relancer le smoke.

- [ ] **Step 5.7: Vérifier l'absence d'orgs/events**

```bash
docker compose -f docker-compose.dev.yml exec app sh -c 'npx --yes prisma db execute --stdin' <<'SQL'
SELECT (SELECT COUNT(*) FROM Organization) AS org_count,
       (SELECT COUNT(*) FROM Event) AS event_count,
       (SELECT COUNT(*) FROM User WHERE isStaff = 1) AS staff_count;
SQL
```

Expected: `org_count=0, event_count=0, staff_count=1`.

- [ ] **Step 5.8: Tester le rollback en local (simulation)**

```bash
# Restaurer le backup precaution dans une DB de test
docker exec badge-db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS badge_rollback_test; CREATE DATABASE badge_rollback_test;"'
docker exec -i badge-db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" badge_rollback_test' < /tmp/badge-dev-precaution/badge.sql
docker exec badge-db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SHOW TABLES;" badge_rollback_test'
```

Expected: liste des tables non vide (le dump est utilisable).

- [ ] **Step 5.9: Nettoyer la DB de test**

```bash
docker exec badge-db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS badge_rollback_test;"'
```

- [ ] **Step 5.10: Documenter le résultat du dry run**

Ajouter une ligne dans `docs/v2/installation.md` section "Références" (avant la liste finale) :

```
> Dernier dry run complet validé en local le YYYY-MM-DD : 8/8 smoke tests OK.
```

Puis commit :

```bash
git add docs/v2/installation.md
git commit -m "docs(v2): trace du dry run d'installation en local"
```

---

## Task 6: Plan de rollback documenté et testé

**Files:** aucun supplémentaire — la section 4 de `docs/v2/installation.md` couvre déjà le rollback. Cette tâche est une **vérification ciblée** que la cible Make et la procédure documentée sont cohérentes.

- [ ] **Step 6.1: Vérifier la cohérence Makefile ↔ doc**

Vérifier que les chemins d'arguments documentés (`SQL=...`, `UPLOADS=...`) correspondent exactement aux variables attendues par la cible :

```bash
grep -E "^rollback-prod:|SQL=|UPLOADS=" Makefile
grep -E "SQL=backups|UPLOADS=backups" docs/v2/installation.md
```

Expected: les deux blocs utilisent les mêmes noms de variables.

- [ ] **Step 6.2: Tester `make rollback-prod` sans arguments (sortie d'usage)**

```bash
make rollback-prod || true
```

Expected sortie :

```
Usage: make rollback-prod SQL=<path.sql> UPLOADS=<path.tar.gz>
```

Et code de sortie 1.

- [ ] **Step 6.3: Tester la confirmation interactive (annulation)**

```bash
# Doit s'annuler proprement si on tape autre chose que "rollback"
echo "non" | make rollback-prod SQL=/dev/null UPLOADS=/dev/null || true
```

Expected: message `Cancelled.` puis sortie 1. Aucune commande destructive exécutée.

- [ ] **Step 6.4: Vérifier qu'aucun fichier n'a été touché**

```bash
docker exec badge-db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SHOW DATABASES;"' | grep badge
```

Expected: la base `badge` existe toujours (avec son contenu post-seed du Task 5).

- [ ] **Step 6.5: Pas de commit ici** — la tâche est de validation pure.

---

## Task 7: Procédure de déploiement prod (runbook manuel)

**Files:** aucun — checklist à exécuter le jour J par un humain.

> Ce plan ne lance **jamais** automatiquement de commande sur la prod. Cette tâche existe pour formaliser la liste d'actions humaines, avec les commandes exactes correspondantes. À cocher manuellement le jour du déploiement.

### Pré-déploiement (J-1)

- [ ] **Step 7.1: Annoncer la fenêtre de maintenance**

Notifier les utilisateurs au moins 24 h avant. Bannière sur la page d'accueil v1 si possible.

- [ ] **Step 7.2: Vérifier que le tag v2 est créé**

```bash
git tag -l "v2.*"
```

Expected: au moins un tag `v2.0.0` (ou candidat équivalent).

- [ ] **Step 7.3: Préparer le `.env.production` v2**

Sur la machine d'admin :

```bash
cp .env.production.example .env.production.staging
# Editer .env.production.staging avec les vraies valeurs prod
# Verifier visuellement chaque ligne
```

### Jour J — Maintenance

- [ ] **Step 7.4: Se connecter au serveur**

```bash
ssh root@<serveur>
cd ~/badge
```

- [ ] **Step 7.5: Vérifier l'espace disque (pour les backups)**

```bash
df -h ~/badge/backups
```

Expected: ≥ 5 Go libres.

- [ ] **Step 7.6: Backup intégral v1**

```bash
make backup-prod
ls -lh backups/
```

Conserver les deux fichiers horodatés (`badge-<TS>.sql`, `uploads-<TS>.tar.gz`). Noter le `<TS>` exact :

```
TS_PROD=____________  # a remplir le jour J
```

- [ ] **Step 7.7: Copier les backups hors-serveur (sécurité)**

Depuis la machine d'admin :

```bash
mkdir -p ~/badge-backups-pre-v2
scp root@<serveur>:~/badge/backups/badge-${TS_PROD}.sql ~/badge-backups-pre-v2/
scp root@<serveur>:~/badge/backups/uploads-${TS_PROD}.tar.gz ~/badge-backups-pre-v2/
```

- [ ] **Step 7.8: Récupérer le code v2 sur le serveur**

Option A — push depuis dev :

```bash
# Sur dev
make upload
```

Option B — pull direct sur le serveur :

```bash
# Sur le serveur
git fetch --tags
git checkout v2.0.0
```

- [ ] **Step 7.9: Mettre à jour `.env.production`**

```bash
# Sauvegarder l'ancien
cp .env.production .env.production.v1.bak
# Coller la nouvelle version (preparee a la Step 7.3)
nano .env.production
```

Vérifier la présence des clés v2 :

```bash
grep -E "^PLATFORM_SMTP_|^SEED_STAFF_" .env.production
```

Expected: 6 lignes `PLATFORM_SMTP_*` + 2 lignes `SEED_STAFF_*`.

- [ ] **Step 7.10: Rebuild les images Docker v2**

```bash
make prod-build
```

Expected: les services `badge-app`, `badge-db`, `badge-pma`, `badge-caddy` redémarrent. `docker compose ps` les montre tous en `running`.

- [ ] **Step 7.11: Reset BDD + uploads + seed v2**

```bash
make prod-db-reset-v2
# Taper "reset-v2" pour confirmer
```

Expected sortie finale : `Production database v2 reset and seeded.`

- [ ] **Step 7.12: Lancer les smoke tests**

```bash
make smoke-tests
```

Expected : 8/8 OK. **Si échec → passer immédiatement à la Step 7.16 (rollback).**

- [ ] **Step 7.13: Première connexion STAFF_ADMIN**

Depuis un navigateur :

1. Ouvrir `https://<domaine>/login`
2. Email : `SEED_STAFF_EMAIL`
3. Mot de passe : `SEED_STAFF_PASSWORD`
4. Vérifier l'accès à `/staff` (dashboard staff vide attendu)
5. Aller à `/profile` et changer immédiatement le mot de passe

- [ ] **Step 7.14: Désactiver l'éventuel splash de maintenance**

Si un splash Caddy était activé, le retirer dans `Caddyfile` puis :

```bash
docker exec badge-caddy caddy reload --config /etc/caddy/Caddyfile
```

- [ ] **Step 7.15: Annoncer la fin de maintenance**

Notification utilisateurs : v2 en ligne, accès initial réservé staff (les clients n'ont pas encore d'org).

### Post-déploiement

- [ ] **Step 7.16: (En cas d'échec) Rollback immédiat**

Sur le serveur :

```bash
make prod-down
make rollback-prod \
  SQL=backups/badge-${TS_PROD}.sql \
  UPLOADS=backups/uploads-${TS_PROD}.tar.gz
# Taper "rollback" pour confirmer
git checkout v1.x.x                  # remplacer par le dernier tag v1 stable
cp .env.production.v1.bak .env.production
make prod-build
make prod
```

Vérifier que `https://<domaine>/login` répond en HTTP 200. Si oui, déploiement abandonné, post-mortem requis avant nouvelle tentative.

- [ ] **Step 7.17: Surveillance H+1 et H+24**

- Logs : `make prod-logs` (chercher erreurs Prisma, NextAuth, SMTP)
- Smoke : relancer `make smoke-tests` toutes les heures pendant 24 h
- Métriques : vérifier l'absence d'augmentation anormale de 5xx côté Caddy

- [ ] **Step 7.18: Nettoyage J+7**

Une fois la prod stable :

```bash
# Supprimer les backups locaux dupliques (les originaux restent sur le serveur)
# Marquer le tag v2.0.0 comme stable
```

> Cette tâche n'est **pas** commitée par l'IA. Le runbook ci-dessus vit dans le plan (et dans `docs/v2/installation.md` pour les sections réutilisables). Pas de fichier supplémentaire à créer.

---

## Vérification finale du plan

- [ ] **Step F.1: Tous les tests passent**

```bash
make test
```

Expected: tous les fichiers `*.test.ts` passent (Plan 1 + nouveau test `scripts/__tests__/smoke-tests.test.ts`).

- [ ] **Step F.2: Lint et typecheck**

```bash
make lint
make typecheck
```

Expected: aucune erreur.

- [ ] **Step F.3: État Git propre**

```bash
git status
git log --oneline -10
```

Expected: working tree clean. Historique attendu (ordre du plus récent au plus ancien) :

```
docs(v2): trace du dry run d'installation en local
docs(v2): procedure installation, reset, smoke tests et rollback
feat(v2): script smoke-tests + test unitaire de assert
feat(v2): cibles Makefile pour reset prod v2 (backup, reset, smoke, rollback)
feat(v2): modele .env.production v2 et gitignore backups
... (commits Plan 1 en dessous)
```

- [ ] **Step F.4: Fichiers livrés**

```bash
ls -1 scripts/smoke-tests.ts scripts/__tests__/smoke-tests.test.ts .env.production.example docs/v2/installation.md Makefile
```

Expected: les 5 chemins existent.

---

## Notes finales

- **Aucune route ou page applicative n'est ajoutée par ce plan.** Il s'agit uniquement d'outillage (Makefile, script Node, doc) qui prépare la prod à recevoir les features livrées par les Plans 2 à 6.
- **L'exécution réelle de Task 7 est manuelle**, le jour du déploiement. Le plan automatisable s'arrête à Task 6.
- **Choix de simplicité retenus** :
  - Pas de mécanisme automatique de purge des backups (un cron documenté suffit).
  - Pas de splash de maintenance automatisé (manuel via Caddy si nécessaire).
  - Pas de CI/CD : `make upload` + `make deploy` restent suffisants tant que le déploiement est mensuel.
  - `prod-db-reset-v2` ne réutilise pas `prod-db-reset` (v1) pour rester explicite sur l'intention.
- **Dépendances** :
  - Plan 1 doit être appliqué (schéma Prisma v2 + seed minimal). Sans lui, `make prod-db-reset-v2` échoue au seed.
  - Plan 6 (notifications email) consomme `PLATFORM_SMTP_*` ; les variables doivent être valides en prod avant les premiers envois.
- **Sortie de ce plan** : la plateforme est en ligne, vide (1 staff, 0 org, 0 event). Le staff démarre l'onboarding via `/staff` (couvert par Plan 2).
