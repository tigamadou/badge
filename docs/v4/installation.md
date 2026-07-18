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
| `caddy` | 80 / 443 | -- | Reverse proxy dev HTTPS |

Les ports directs (`localhost:3785`, `localhost:8080`, `localhost:8025`)
restent exposes en parallele.

## HTTPS local

### 1. Renseigner `/etc/hosts`

Une seule ligne sur la machine hote (une seule fois) :

```bash
echo "127.0.0.1 badge.local pma.badge.local mail.badge.local" | sudo tee -a /etc/hosts
```

### 2. Faire confiance a la CA interne de Caddy

Caddy genere une autorite de certification locale (`Caddy Local Authority`) au
premier demarrage et l'utilise pour signer les certificats `*.badge.local`.
Pour supprimer l'avertissement du navigateur, importer et approuver la racine :

```bash
# Extraire la racine CA du conteneur caddy
docker compose -f docker-compose.dev.yml cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt

# macOS : ajouter au trousseau Systeme et marquer "Toujours approuver"
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ./caddy-root.crt
rm caddy-root.crt
```

Sur Linux : copier `caddy-root.crt` dans `/usr/local/share/ca-certificates/` puis
`sudo update-ca-certificates`. Firefox utilise son propre magasin de certificats :
importer la racine via `Parametres > Vie privee et securite > Certificats`.

### 3. Aligner l'URL de base de l'app

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
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" http://badge.local/   # attendu : 308 https://badge.local/
curl -k -sS -o /dev/null -w "%{http_code}\n" https://badge.local/                # attendu : 200
```

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
