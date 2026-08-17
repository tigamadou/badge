# Installation - Badge v4

> Cette page complete le `README.md` racine avec les specificites v4. Pour la
> methode generale de demarrage (`make dev`, seed, variables d'environnement),
> se referer au README.

## Services et URLs (dev)

Le reverse proxy Caddy sert les sous-domaines `*.badge.local` en **HTTPS** via
sa CA interne (`tls internal`). Le HTTP est redirige vers HTTPS.

| Service | Port direct | URL via Caddy (HTTPS) | Description |
|---------|-------------|-----------------------|-------------|
| `app` | 3785 | `https://badge.local` | Next.js avec hot reload |
| `mysql` | 33060 | -- | Base de donnees MySQL |
| `phpmyadmin` | 8080 | `https://pma.badge.local` | Interface admin BDD |
| `mailpit` | 8025 | `https://mail.badge.local` | Capture d'emails |
| `minio` | 9001 | `https://s3.badge.local` | Console MinIO (stockage S3) |
| `caddy` | 80 / 443 | -- | Reverse proxy dev HTTPS |

Les ports directs (`localhost:3785`, `localhost:8080`, `localhost:8025`)
restent exposes en parallele.

## HTTPS local

Il n'y a **aucun certificat a generer** : Caddy signe lui-meme les certificats
`*.badge.local` avec une autorite locale (`Caddy Local Authority`) creee au
premier demarrage et persistee dans le volume `caddy_data_dev`. Le travail
consiste seulement a resoudre les domaines vers `127.0.0.1` et a faire confiance
a cette racine.

### 1. Tout configurer en une commande

```bash
make dev            # la stack doit tourner (la CA est generee par le conteneur)
make dev-https      # /etc/hosts + approbation de la CA (mot de passe admin demande)
make dev-https-check
```

`make dev-https` est **idempotent** : il n'ajoute a `/etc/hosts` que les domaines
manquants et ne reinstalle pas une CA deja approuvee. Les domaines traites sont
lus dans `Caddyfile.dev`, donc ajouter un site au proxy suffit a le couvrir.

| Commande | Role |
|----------|------|
| `make dev-https` | Enchaine `dev-https-hosts` + `dev-https-trust`. |
| `make dev-https-hosts` | Ajoute les domaines manquants a `/etc/hosts`. |
| `make dev-https-trust` | Extrait la racine CA du conteneur et l'installe dans le magasin systeme (macOS : trousseau Systeme ; Linux : `/usr/local/share/ca-certificates`). |
| `make dev-https-check` | Verifie sans `-k` que la chaine est valide sur chaque domaine. |
| `make dev-https-untrust` | Retire les CA Caddy du magasin systeme. |

> **Apres un `docker compose -f docker-compose.dev.yml down -v`** : le volume
> `caddy_data_dev` disparait, Caddy regenere une CA differente et l'ancienne
> racine approuvee ne vaut plus rien. Lancer `make dev-https-untrust` puis
> `make dev-https` pour repartir propre (sinon les vieilles racines s'accumulent
> dans le trousseau).

**Firefox** utilise son propre magasin de certificats et n'est pas couvert par
ces cibles : importer la racine via *Parametres > Vie privee et securite >
Certificats*. Pour l'obtenir :

```bash
docker compose -f docker-compose.dev.yml cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
```

### 2. Aligner l'URL de base de l'app

L'app doit se savoir servie en `https://badge.local` pour que les liens des
emails et les callbacks NextAuth soient coherents. La valeur committable vit
dans `docker/compose.dev.env` :

```
NEXTAUTH_URL=https://badge.local
```

> Attention : un `.env` present a la racine du projet est charge **apres**
> `docker/compose.dev.env` et **ecrase** cette valeur. Si vous avez un `.env`
> local avec `NEXTAUTH_URL=http://localhost:3000`, mettez-le a jour vers
> `https://badge.local` (ou retirez la ligne) puis recreez le conteneur app :
> `docker compose -f docker-compose.dev.yml up -d --no-deps app`. Ce redemarrage
> invalide les sessions en cours (changement d'origine http -> https).

### Verification

```bash
make dev-https-check   # attendu : une ligne "OK <domaine> (http=308 -> https=200)" par site
```

Une ligne `KO` signifie soit que le domaine n'est pas dans `/etc/hosts`, soit que
la CA approuvee ne correspond plus a celle du conteneur (cas du `down -v`).

Dans le navigateur (apres confiance CA) : `https://badge.local` affiche le
cadenas sans avertissement. Les liens captures dans Mailpit
(`https://mail.badge.local`) commencent par `https://badge.local`.

## Tests

Toutes les commandes tournent dans le conteneur dev (`make dev` prealable).

| Commande | Description |
|----------|-------------|
| `make test` | Suite Vitest complete (unitaire lib + integration API). |
| `make test-unit` | Sous-ensemble unitaire cible sur `src/lib`. |
| `make test-coverage` | Vitest + rapport de couverture V8. **Seuils 100%** (lignes/branches/fonctions/statements) sur `src/lib/**` et `src/app/api/**` = gate (`vitest.config.ts`). |
| `make test-e2e` | Playwright (chromium systeme) dans le conteneur, contre `http://localhost:3000`. |
| `make test-e2e-ui` | Playwright mode UI depuis l'hote (fenetre Electron ; app sur `localhost:3785`). |
| `make test-all` | `lint` + `typecheck` + `test` + `test-e2e`, s'arrete au premier echec. |

> **Attention** : `make test` (et `test-coverage`/`test-all`) **vide la base de dev**
> (`src/test-setup.ts` fait un `deleteMany` global en `beforeEach`). Relancer
> `make db-seed` ensuite pour retrouver les comptes de dev. Les tests e2e seedent
> leurs propres fixtures (`e2e/helpers/`) et ne dependent pas du seed global.

> **Templates de badge** (v4, plan 12) : `make db-seed` installe aussi les modeles de
> badge livres avec l'application, depuis `prisma/badge-templates/`. Sans lui, aucun
> badge n'est imprimable et `resolveTemplate` echoue explicitement. Deux cibles
> associees : `make validate-badge-templates` verifie qu'aucune reference n'est
> orpheline, et `make migrate-badge-template-refs` convertit les anciennes references
> texte d'une base anterieure au plan 12 (inutile sur une base neuve).

| Commande | Description |
|----------|-------------|
| `make new-badge-template NAME=<slug>` | Cree un squelette de template dans `badge-templates/<slug>/` (atelier gitignore) |
| `make pack-badge-template NAME=<slug>` | Empaquette ce dossier en archive installable, apres validation du manifeste |

Voir `docs/v4/features/templates-badges.md` pour le format du manifeste.

**Pre-requis Playwright / MinIO** : le chromium systeme est installe dans le conteneur
`app` (cf. commentaire de la cible `test-e2e` dans le `Makefile`) ; le stockage objet
(MinIO) doit tourner (`make dev` le demarre) pour les tests d'upload.

## Integration continue (GitHub Actions)

Le workflow `.github/workflows/ci.yml` s'execute sur chaque **push** et **pull request**
vers `development`. Quatre jobs paralleles bloquants :

1. **lint** — `yarn lint` (ESLint, 0 erreur ; warnings au niveau baseline toleres).
2. **typecheck** — `yarn tsc --noEmit`.
3. **unit-integration** — service MySQL 8, `prisma db push`, `yarn vitest run --coverage` (les seuils 100% font gate).
4. **e2e** — services MySQL + Mailpit + MinIO, `prisma db seed`, build Next + `yarn start`, `yarn playwright test` (rapport uploade en artefact si echec).

> Le job **e2e** reste rouge tant que la couverture E2E (Phase 3 du plan
> `v4-02`) n'est pas verte. Ne l'ajouter aux checks **requis** qu'une fois la
> suite Playwright stabilisee.

### Protection de branche (action manuelle GitHub)

A configurer a la main dans **Settings > Branches > Branch protection rules** du depot :

- Regle sur `development` : **Require a pull request before merging** (interdit le push direct).
- **Require status checks to pass before merging** + selectionner les checks requis :
  `lint`, `typecheck`, `unit-integration` (ajouter `e2e` une fois la Phase 3 verte).
- **Require branches to be up to date before merging** (recommande).

> Cette activation est une operation **manuelle** de l'administrateur du depot :
> elle ne peut pas etre automatisee par le workflow lui-meme.
