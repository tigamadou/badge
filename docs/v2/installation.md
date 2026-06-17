# Installation et deploiement v2

> **Statut : runbook operationnel pour Badge v2.**
>
> Ce document couvre :
>
> 1. Les pre-requis serveur (Docker, ports, Caddy).
> 2. Le referentiel des variables d'environnement v2 (`.env.production.example`).
> 3. La **procedure de deploiement initial v2** (premiere installation propre, sans donnees prealables).
> 4. La **procedure de reset v2** (passage d'une instance v1 existante vers v2, base existante a effacer).
> 5. Les smoke tests post-deploiement.
> 6. Le plan de rollback vers la v1.
> 7. Un tableau recapitulatif des cibles Makefile v2.
> 8. Le troubleshooting des cas frequents.
>
> Spec source : [`docs/v2/features/deploiement-initial.md`](features/deploiement-initial.md). Plan d'implementation : [`docs/v2/plans/2026-05-28-v2-07-deploiement-initial.md`](plans/2026-05-28-v2-07-deploiement-initial.md).

---

## 1. Pre-requis serveur

| Composant | Version minimale | Notes |
|-----------|------------------|-------|
| OS | Debian 12 / Ubuntu 22.04 LTS | Tout OS Linux supportant Docker Engine 24+ |
| Docker Engine | 24.x | `docker --version` |
| Docker Compose | v2 (plugin) | `docker compose version` (et non `docker-compose`) |
| Acces SSH | `root@<serveur>` ou utilisateur dans le groupe `docker` | cf cible `SERVER=` du `Makefile` |
| RAM | 2 Go minimum, 4 Go recommandes | Build Next.js + MySQL |
| Disque | 10 Go libres minimum | + 5 Go reserves pour `backups/` |
| Domaine | Un FQDN pointe vers le serveur en A/AAAA | Caddy gere TLS automatique via Let's Encrypt |

### Ports a ouvrir

| Port | Direction | Usage |
|------|-----------|-------|
| `22/tcp` | entrant | SSH (deploiement) |
| `80/tcp` | entrant | HTTP -> redirection HTTPS par Caddy + challenge ACME |
| `443/tcp` + `443/udp` | entrant | HTTPS et HTTP/3 (Caddy) |
| `443/tcp` sortant | sortant | Recuperation polices Google Fonts (Montserrat, requis pour PDF badge) |

**Reverse proxy** : Caddy 2 (image `caddy:2-alpine`) embarque dans la stack via `docker-compose.yml`. La configuration TLS est entierement automatique (Let's Encrypt + HTTP-01 challenge) tant que les ports 80/443 sont accessibles et que le `Caddyfile` declare le domaine final.

---

## 2. Variables d'environnement

Toutes les variables vivent dans `.env.production` a la racine du projet sur le serveur. **Ce fichier n'est jamais commit**. Le modele versionne est `.env.production.example`.

### 2.1 Tableau des variables critiques

| Section | Variable | Description |
|---------|----------|-------------|
| Base de donnees | `DATABASE_URL` | URL MySQL au format `mysql://root:<password>@mysql:3306/badge`. |
| Base de donnees | `MYSQL_ROOT_PASSWORD` | Mot de passe root MySQL, reutilise par les cibles `backup-prod` / `prod-db-reset-v2` / `rollback-prod`. |
| NextAuth | `NEXTAUTH_SECRET` | Cle de signature des JWT NextAuth. **Generer avec** `openssl rand -base64 32`. |
| NextAuth | `NEXTAUTH_URL` | URL publique HTTPS de l'app (ex : `https://badge.exemple.tld`). |
| NextAuth | `BASE_URL` | URL utilisee dans les emails (liens d'inscription, verify, edit). Generalement identique a `NEXTAUTH_URL`. |
| SMTP plateforme | `PLATFORM_SMTP_HOST` | Hote SMTP plateforme. |
| SMTP plateforme | `PLATFORM_SMTP_PORT` | Port SMTP (`587` STARTTLS, `465` SSL implicite). |
| SMTP plateforme | `PLATFORM_SMTP_FROM` | Adresse expediteur unique pour **tous** les emails de la plateforme. |
| SMTP plateforme | `PLATFORM_SMTP_USER` | Utilisateur SMTP. |
| SMTP plateforme | `PLATFORM_SMTP_PASSWORD` | Mot de passe SMTP. |
| SMTP plateforme | `PLATFORM_SMTP_SECURE` | `true` pour SSL implicite (port 465), `false` pour STARTTLS (port 587). |
| Seed initial | `SEED_SUPER_ADMIN_EMAIL` | Email du premier compte `SUPER_ADMIN` cree par le seed. |
| Seed initial | `SEED_SUPER_ADMIN_PASSWORD` | Mot de passe temporaire **a changer apres le premier login** via `/profile`. |
| reCAPTCHA | `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Cle publique reCAPTCHA v3 (optionnel, laisser vide pour desactiver le widget). |
| reCAPTCHA | `RECAPTCHA_SECRET_KEY` | Cle secrete reCAPTCHA v3 (idem). |

### 2.2 Decisions v2 importantes

- **SMTP plateforme = source unique** (decision 2026-05-31). Tous les emails partent via `PLATFORM_SMTP_*` avec `PLATFORM_SMTP_FROM` comme expediteur. Il n'y a **plus** d'override `OrgSettings` ou `EventSettings` cote SMTP. Le branding contextuel (logo, contact org/event) est en revanche cascade depuis l'event/organisation.
- **reCAPTCHA plateforme = source unique** : une seule paire de cles Google partagee pour tous les events. Aucun override `OrgSettings` ou `EventSettings`. Laisser vide pour desactiver completement le widget.
- **Plus de variables v1** : `SMTP_*` (sans prefixe `PLATFORM_`), `SEED_ADMIN_*`, `RECAPTCHA_SITE_KEY` (sans `NEXT_PUBLIC_`) **ne sont plus lues par le code v2**. Si elles trainent dans l'ancien `.env.production` de la v1, les supprimer.

### 2.3 Nom de la base de donnees

La base s'appelle `badge` partout : `DATABASE_URL`, `MYSQL_DATABASE` (cf `docker-compose.yml` et `docker-compose.dev.yml`), et les cibles `backup-prod` / `prod-db-reset-v2` / `rollback-prod` du `Makefile`. Aucun patch a appliquer.

### 2.4 Note environnement de dev

En **dev local**, la base s'appelle `badge` (cf `.env`). Les conteneurs dev portent les noms automatiques `badge-mysql-1`, `badge-app-1` (suffixe `-1` ajoute par Docker Compose puisqu'aucun `container_name` n'est defini dans `docker-compose.dev.yml`). En **prod**, les conteneurs portent les noms fixes `badge-app`, `badge-db`, `badge-pma`, `badge-caddy` (cf `docker-compose.yml`).

**Domaines dev `*.badge.local`** : un reverse proxy Caddy est inclus dans `docker-compose.dev.yml` et expose les services en HTTP sur le port 80 de l'hote :

- `http://badge.local` -> app (Next.js)
- `http://pma.badge.local` -> phpmyadmin
- `http://mail.badge.local` -> mailpit (UI)

Pour activer ces URL, ajouter au `/etc/hosts` de la machine hote (sudo requis) :

```
127.0.0.1 badge.local pma.badge.local mail.badge.local
```

Les ports directs (`localhost:3000`, `localhost:8080`, `localhost:8025`) restent expose en parallele.

---

## 3. Procedure de deploiement initial v2 (instance neuve)

A appliquer pour une **premiere installation propre**, sans donnees prealables sur le serveur. Si vous remplacez une v1 existante, voir la section 4.

### 3.1 Cloner le repo sur le serveur

```bash
ssh root@<serveur>
git clone <repo-url> /root/badge
cd /root/badge
git checkout v2.0.0   # ou la branche development si pas encore taggue
```

### 3.2 Preparer `.env.production`

```bash
cp .env.production.example .env.production
nano .env.production
```

Renseigner toutes les variables de la section 2.1, en particulier :

- Generer `NEXTAUTH_SECRET` : `openssl rand -base64 32`
- Choisir un `MYSQL_ROOT_PASSWORD` aleatoire de >= 20 caracteres
- Definir `SEED_SUPER_ADMIN_EMAIL` et `SEED_SUPER_ADMIN_PASSWORD` (le mot de passe sera change apres le premier login)
- Configurer le bloc `PLATFORM_SMTP_*` complet
- `NEXTAUTH_URL` et `BASE_URL` doivent correspondre au domaine declare dans le `Caddyfile`

Verifier qu'aucun secret n'est traque :

```bash
git ls-files | grep -E "^\.env(\.|$)" | grep -v ".example"
```

Resultat attendu : aucune sortie.

### 3.3 Build des images et demarrage

```bash
make prod-build
```

Equivalent a `docker compose down && docker compose up --build -d`. Verifier l'etat :

```bash
docker compose ps
```

Resultat attendu : `badge-app`, `badge-db`, `badge-pma`, `badge-caddy` en `running`.

### 3.4 Pousser le schema Prisma

```bash
make prod-db-push
```

Equivalent a `docker exec badge-app npx --yes prisma db push`. La base passe au schema v2 (User, Organization, Event, Memberships, Categories, Registration, Settings, ActivityLog).

### 3.5 Seed initial (SUPER_ADMIN + PlatformSettings)

```bash
make prod-seed
```

Equivalent a `docker exec badge-app yarn tsx prisma/seed.ts`. Sortie attendue :

```
PlatformSettings singleton created.
SUPER_ADMIN created: <SEED_SUPER_ADMIN_EMAIL>
```

> **Note** : le seed v2 ne cree **pas** d'organisation ni d'event. La table `OrgSettings` n'existe plus en v2 (fusionnee dans `Organization`). Les `Organization` et `Event` sont crees ulterieurement par le staff via `/staff/*`.

### 3.6 Smoke tests

```bash
make smoke-tests
```

Voir section 5 pour le detail. Resultat attendu : 8/8 OK.

### 3.7 Premier login SUPER_ADMIN

1. Ouvrir `https://<domaine>/login` dans un navigateur.
2. Email : valeur de `SEED_SUPER_ADMIN_EMAIL`.
3. Mot de passe : valeur de `SEED_SUPER_ADMIN_PASSWORD`.
4. **Aller immediatement dans `/profile` et changer le mot de passe**.
5. Verifier l'acces a `/staff` (dashboard staff vide attendu : 0 org, 0 event).

### 3.8 Onboarding initial

Le SUPER_ADMIN cree la premiere organisation via `/staff/organizations` puis assigne un user OWNER. Voir [`docs/v2/features/espace-staff.md`](features/espace-staff.md).

---

## 4. Procedure de reset v2 (depuis une instance v1 existante)

A appliquer pour **remplacer une instance v1 deployee** par une v2 propre. Toutes les donnees v1 (registrations, badges, settings, users) sont effacees : il n'y a **pas de migration de donnees** v1 vers v2 (decision design 2026-05-28). Un backup integral est realise avant le drop pour garantir le rollback.

**Duree estimee : 15 a 20 minutes.** Effectuer en fenetre de maintenance annoncee >= 24h a l'avance.

### 4.1 Pre-deploiement (J-1)

- Annoncer la fenetre de maintenance aux utilisateurs.
- Verifier que le tag `v2.0.0` (ou la branche cible) est pushe sur le remote.
- Preparer le `.env.production` v2 en local (cf section 2) et le tester contre `.env.production.example`.

### 4.2 Backup integral

```bash
ssh root@<serveur>
cd /root/badge
make backup-prod
ls -lh backups/
```

`backup-prod` produit deux fichiers horodates :

- `backups/badge-<YYYYMMDD-HHMMSS>.sql` : dump SQL complet (`mysqldump --single-transaction --routines --triggers`).
- `backups/uploads-<YYYYMMDD-HHMMSS>.tar.gz` : archive tar.gz du volume `badge_uploads_data`.

Noter le timestamp **exact** (`TS_PROD=YYYYMMDD-HHMMSS`) : il sera reutilise par le rollback.

**Copier les backups hors du serveur** (defense en profondeur) :

```bash
# Depuis la machine d'admin
mkdir -p ~/badge-backups-pre-v2
scp root@<serveur>:/root/badge/backups/badge-${TS_PROD}.sql ~/badge-backups-pre-v2/
scp root@<serveur>:/root/badge/backups/uploads-${TS_PROD}.tar.gz ~/badge-backups-pre-v2/
```

> Conserver ces fichiers **au moins 30 jours**.

### 4.3 Annoncer la maintenance (splash Caddy, optionnel)

Si un splash de maintenance Caddy est prepare (page statique servie par Caddy en lieu et place de l'upstream Next.js), l'activer maintenant. Sinon, accepter le downtime applicatif pendant le reset (~5-10 min effectives).

### 4.4 Arret de la stack v1

```bash
make prod-down
```

Equivalent a `docker compose down`. Le volume `mysql_data` et `uploads_data` sont **preserves** (down sans `-v`), garantissant la possibilite de rollback.

### 4.5 Pull du code v2

```bash
git fetch --tags
git checkout v2.0.0   # ou la branche cible (development, feat/v2-implementation)
```

Sauvegarder l'ancien `.env.production` v1 :

```bash
cp .env.production .env.production.v1.bak
```

Coller la nouvelle version v2 preparee a l'etape 4.1 :

```bash
nano .env.production
# Verifier la presence des cles v2
grep -E "^PLATFORM_SMTP_|^SEED_SUPER_ADMIN_" .env.production
```

Resultat attendu : 6 lignes `PLATFORM_SMTP_*` + 2 lignes `SEED_SUPER_ADMIN_*`.

### 4.6 Rebuild des images Docker v2

```bash
make prod-build
```

Verifier `docker compose ps` : les 4 conteneurs sont `running`.

### 4.7 Reset BDD + uploads + push schema + seed

```bash
make prod-db-reset-v2
```

La commande demande la confirmation `reset-v2` (et non `yes`, pour eviter tout declenchement accidentel). Elle enchaine :

1. `DROP DATABASE badge; CREATE DATABASE badge;` (depuis le conteneur `badge-db`).
2. Vide le volume `uploads_data` (`rm -rf /app/uploads/*` depuis `badge-app`).
3. `npx prisma db push` (cree les tables v2).
4. `npx prisma generate` (regenere le client Prisma).
5. `yarn tsx prisma/seed.ts` (cree `PlatformSettings` + premier SUPER_ADMIN).

Sortie attendue (derniere ligne) : `Production database v2 reset and seeded.`

### 4.8 Smoke tests

```bash
make smoke-tests
```

Resultat attendu : 8/8 OK. **Si echec -> passer immediatement a la section 6 (rollback).**

### 4.9 Premier login SUPER_ADMIN

Idem section 3.7 : ouvrir `https://<domaine>/login`, se connecter avec `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD`, **changer immediatement le mot de passe via `/profile`**.

### 4.10 Desactiver le splash de maintenance

Si un splash Caddy etait actif, le retirer dans le `Caddyfile` puis :

```bash
docker exec badge-caddy caddy reload --config /etc/caddy/Caddyfile
```

### 4.11 Annoncer la fin de maintenance

Notifier les utilisateurs : v2 en ligne, acces initial reserve staff (les clients n'ont pas encore d'org).

### 4.12 Surveillance H+1 / H+24

- `make prod-logs` : surveiller les erreurs Prisma, NextAuth, SMTP.
- Relancer `make smoke-tests` toutes les heures pendant 24h.
- Cote Caddy : verifier l'absence de pic de `5xx`.

---

## 5. Smoke tests

Le script `scripts/smoke-tests.ts` (execute via `tsx` dans le conteneur `badge-app`) realise **8 verifications** apres deploiement :

| # | Check | Description |
|---|-------|-------------|
| 1 | `DB SELECT 1` | Connexion Prisma + MySQL OK (requete raw `SELECT 1`). |
| 2 | `PlatformSettings singleton` | La ligne `PlatformSettings { id: "singleton" }` existe en base (seedee). |
| 3 | `Au moins un staff seede` | Au moins un `User` avec `isStaff = true` existe en base (SUPER_ADMIN seede). |
| 4 | `Aucune organisation en base` | `Organization.count() === 0` : etat initial post-seed. |
| 5 | `Aucun event en base` | `Event.count() === 0` : etat initial post-seed. |
| 6 | `HTTP GET <baseUrl>/login` | La page de login repond `200`. |
| 7 | `HTTP GET <baseUrl>/staff sans session` | La route protegee `/staff` repond `200`, `302` ou `307` (redirect NextAuth). |
| 8 | `HTTP GET <baseUrl>/api/auth/providers` | L'API NextAuth est initialisee (`200` + provider `credentials` present). |

### Lancement

```bash
make smoke-tests
```

Equivalent a `docker exec badge-app yarn tsx scripts/smoke-tests.ts`. En dev, on peut aussi le lancer manuellement :

```bash
docker compose -f docker-compose.dev.yml exec app sh -c 'BASE_URL=http://app:3000 yarn tsx scripts/smoke-tests.ts'
```

### Interpretation de la sortie

Sortie nominale (tous OK) :

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

Sortie en echec (exemple) :

```
[OK] DB SELECT 1
[FAIL] PlatformSettings singleton -- PlatformSettings manquant
...

3 smoke test(s) en echec.
```

Le script ne s'arrete **pas** a la premiere erreur : il agrege tous les resultats puis sort en code `1` si au moins un check a echoue. Cela permet de diagnostiquer plusieurs problemes en une passe.

Code de sortie : `0` si tous OK, `1` si au moins un FAIL.

---

## 6. Plan de rollback

A declencher si :

- Les smoke tests sont rouges et la cause n'est pas corrigible en quelques minutes.
- L'application ne demarre pas apres `make prod-build`.
- Une regression critique est detectee dans les premieres heures post-deploiement.

### 6.1 Identifier le backup a restaurer

```bash
ssh root@<serveur>
cd /root/badge
ls -lh backups/
```

Choisir la **paire la plus recente** : `badge-<TS>.sql` **et** `uploads-<TS>.tar.gz` avec le **meme** `<TS>` (genere par `make backup-prod`).

### 6.2 Restaurer

```bash
make prod-down
make rollback-prod \
  SQL=backups/badge-<TS>.sql \
  UPLOADS=backups/uploads-<TS>.tar.gz
```

La commande demande la confirmation `rollback`. Elle execute :

1. `DROP DATABASE badge; CREATE DATABASE badge;`
2. Importe le dump SQL dans la base recreee.
3. Vide le volume `uploads_data`.
4. Decompresse l'archive uploads dans le volume.

Sortie attendue : `Rollback termine. Verifier l'application.`

### 6.3 Repasser sur le code v1

```bash
git checkout v1.x.x        # remplacer par le dernier tag v1 stable
cp .env.production.v1.bak .env.production
make prod-build
make prod
```

### 6.4 Verifier que la v1 repond

```bash
curl -I https://<domaine>/login
```

Resultat attendu : `HTTP/2 200`. Verifier visuellement dans un navigateur que la page d'accueil v1 s'affiche correctement.

Si le site ne repond toujours pas :

- `make prod-logs` (chercher les erreurs).
- Revenir a une sauvegarde plus ancienne.
- Post-mortem requis avant nouvelle tentative de migration v2.

---

## 7. Cibles Makefile v2

### 7.1 Cibles dev

| Cible | Description |
|-------|-------------|
| `make dev` | Demarre la stack dev (app, mysql, mailpit, phpmyadmin) |
| `make dev-build` | Rebuild les images dev puis demarre |
| `make dev-down` | Arrete la stack dev |
| `make dev-restart` | Cycle down + up dev |
| `make logs` | Suivi des logs dev |
| `make test` | `yarn vitest run` dans le conteneur app |
| `make lint` | `yarn lint` dans le conteneur app |
| `make typecheck` | `yarn tsc --noEmit` dans le conteneur app |
| `make build` | `yarn build` (Next.js production build) dans le conteneur app |
| `make db-push` / `db-seed` / `db-studio` / `db-generate` / `db-reset` | Operations Prisma dans le conteneur dev |

### 7.2 Cibles prod (deploiement initial v2)

| Cible | Description |
|-------|-------------|
| `make prod` | Demarre la stack prod (`docker compose up -d`) |
| `make prod-build` | `docker compose down && docker compose up --build -d` |
| `make prod-down` | Arrete la stack prod (preserve les volumes) |
| `make prod-logs` | Suivi des logs prod |
| `make prod-db-push` | `prisma db push` sur la base prod (cree/met a jour le schema v2 sans data loss) |
| `make prod-seed` | Execute `prisma/seed.ts` dans `badge-app` (cree PlatformSettings + SUPER_ADMIN) |

### 7.3 Cibles prod (reset v2 + outillage)

| Cible | Description | Confirmation |
|-------|-------------|--------------|
| `make backup-prod` | Dump SQL + tar.gz uploads dans `backups/<TS>` | aucune (non destructif) |
| `make migrate-uploads-clear` | Vide le volume uploads_data | `yes` |
| `make prod-db-reset-v2` | DROP+CREATE DB + vide uploads + push schema + seed | `reset-v2` |
| `make smoke-tests` | Lance les 8 checks post-deploiement | aucune |
| `make rollback-prod SQL=... UPLOADS=...` | Restaure le dump et l'archive uploads passes en argument | `rollback` |

### 7.4 Cibles deploiement (sync code / data)

| Cible | Description |
|-------|-------------|
| `make upload` | `rsync` du code vers `<SERVER>:~/badge/` (exclut `node_modules`, `.next`, `uploads`, `backups`) |
| `make deploy` | `upload` + `prod-build` + `prod-db-push` (ne reset pas la base) |
| `make download-uploads` | Recupere le contenu du volume uploads prod en local (via `/tmp` sur le serveur) |
| `make download-db` | `mysqldump` distant + sauvegarde locale dans `backups/badge-<TS>.sql` |

### 7.5 Cibles deconseillees / heritees

| Cible | Description | Notes |
|-------|-------------|-------|
| `make prod-db-reset` | Ancien reset v1 (`prisma db push --force-reset` + seed) | **Deconseille en v2.** Conserve pour compatibilite. Prefere `prod-db-reset-v2` qui gere aussi le vidage uploads. |

---

## 8. Troubleshooting

### 8.1 La base MySQL n'est pas accessible (`Can't connect to MySQL server`)

```bash
docker compose ps
```

- Si `badge-db` n'est pas `running` -> `docker compose up -d mysql` + verifier les logs : `docker logs badge-db`.
- Si `badge-db` est `running` mais le healthcheck echoue -> attendre quelques secondes (init MySQL lent au premier boot), puis relancer.
- Verifier que `DATABASE_URL` pointe bien vers `mysql:3306/<dbname>` (hostname = nom du service Docker, pas `localhost`).
- Verifier la coherence `MYSQL_ROOT_PASSWORD` <-> mot de passe dans `DATABASE_URL`.

### 8.2 Le conteneur `badge-app` crash au demarrage

```bash
docker logs badge-app --tail 100
```

Causes frequentes :

- `NEXTAUTH_SECRET` non defini ou trop court -> erreur NextAuth au boot.
- `DATABASE_URL` mal forme (caracteres speciaux non encodes dans le mot de passe).
- Schema Prisma desynchronise -> relancer `make prod-db-push`.
- Build incomplet -> `make prod-build` (rebuild from scratch).

### 8.3 `make prod-seed` echoue : `PlatformSettings already exists`

C'est normal si le seed a deja tourne : le seed est idempotent et signale simplement que la singleton row existe deja. Pas d'action requise.

### 8.4 `make prod-seed` echoue : `SUPER_ADMIN already exists`

Idem : message informatif, pas une erreur. Le seed ne recree pas un user existant. Pour recreer un SUPER_ADMIN proprement, soit utiliser un autre email (`SEED_SUPER_ADMIN_EMAIL`), soit reset la base via `make prod-db-reset-v2`.

### 8.5 Smoke tests : `[FAIL] DB SELECT 1`

La connexion Prisma <-> MySQL est cassee. Voir 8.1.

### 8.6 Smoke tests : `[FAIL] PlatformSettings singleton`

Le seed n'a pas tourne. Lancer `make prod-seed`.

### 8.7 Smoke tests : `[FAIL] HTTP GET .../login -- Status 502`

Caddy ne joint pas l'upstream Next.js. Verifier :

- `docker compose ps` -> `badge-app` est `running` ?
- `docker logs badge-app` -> Next.js a bien affiche `Ready in Xms` ?
- Le `Caddyfile` declare bien `reverse_proxy app:3000` (nom du service compose) ?

### 8.8 Smoke tests : `[FAIL] HTTP GET .../login -- Status 200, Body vide`

Le serveur Next.js repond mais ne rend pas la page. Verifier les logs : probable erreur de build (variables d'env manquantes au build time, par exemple `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` interpretee comme requise alors qu'elle est vide).

### 8.9 Emails non envoyes (inscriptions, invitations)

- Verifier les `PLATFORM_SMTP_*` (host, port, user, password, secure).
- Tester en se connectant manuellement au SMTP : `docker exec badge-app sh -c 'nc -vz $PLATFORM_SMTP_HOST $PLATFORM_SMTP_PORT'`.
- Verifier dans `ActivityLog` (via `/staff/audit`) qu'il n'y a pas d'erreur silencieuse cote envoi.

### 8.10 Backup `backup-prod` echoue : `mysqldump: command not found`

L'image `mysql:8` doit contenir `mysqldump` (c'est le cas par defaut). Verifier que le conteneur cible est bien `badge-db` (pas `badge-app`). Si le nom de conteneur differe (compose project rename), adapter le `Makefile`.

### 8.11 Backup `backup-prod` : archive uploads vide

Verifier que le volume Docker s'appelle bien `badge_uploads_data` (prefixe = nom du projet compose, par defaut le nom du repertoire `badge`). Si le projet compose tourne sous un autre nom, adapter dans `backup-prod` et `rollback-prod`.

```bash
docker volume ls | grep uploads_data
```

### 8.12 Rollback : `mysql: command not found` ou import echoue

Le `mysql` client est inclus dans l'image `mysql:8`. Si l'erreur survient, verifier que le conteneur `badge-db` est `running`, et que le fichier SQL passe a `SQL=...` est bien accessible (chemin relatif au repertoire courant `cd /root/badge`).

---

## 9. References

- Spec deploiement initial : [`docs/v2/features/deploiement-initial.md`](features/deploiement-initial.md)
- Spec multi-tenancy et RBAC : [`docs/v2/features/multi-tenancy-rbac.md`](features/multi-tenancy-rbac.md)
- Architecture v2 : [`docs/v2/architecture.md`](architecture.md)
- Schema BDD : [`prisma/schema.prisma`](../../prisma/schema.prisma)
- Plan d'implementation v2-07 : [`docs/v2/plans/2026-05-28-v2-07-deploiement-initial.md`](plans/2026-05-28-v2-07-deploiement-initial.md)
- Modele de variables : [`.env.production.example`](../../.env.production.example)
