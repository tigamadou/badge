# Comment déployer les fichiers sur le VPS

Pour mettre en place la nouvelle architecture, vous devez copier manuellement quelques fichiers de configuration sur le serveur. Plus besoin d'envoyer tout le code source !

## Fichiers à copier

Copiez les fichiers suivants depuis votre machine locale vers le dossier de l'environnement sur le serveur (`~/prod/badge` ou `~/preprod/badge`) :

- `deploy.sh` (à la racine)
- `docker-compose.yml` (à la racine)
- `docker-compose.preprod.yml` (si preprod)
- `Caddyfile` (à la racine)

## Exemple de commande (rsync)

Lancez cette commande depuis la racine de votre projet local :

```bash
# Pour la prod
rsync -avz deploy.sh docker-compose.yml Caddyfile root@161.97.115.135:~/prod/badge/

# Pour la preprod
rsync -avz deploy.sh docker-compose.preprod.yml root@161.97.115.135:~/preprod/badge/
```

*Note : Remplacez `root` par l'utilisateur `deploy` une fois qu'il sera créé sur le serveur.*

## Prochaines étapes sur le serveur

1. Rendez-vous sur le serveur : `ssh root@161.97.115.135`
2. Rendez le script d'exécution : `chmod +x ~/prod/badge/deploy.sh` (et preprod)
3. Créez les fichiers `.env.production` et `.env.preprod` directement sur place.
4. Connectez Docker au registre GitHub : `docker login ghcr.io`.

## Stockage S3 : RustFS (remplace MinIO)

MinIO n'est plus distribué (images retirées de Docker Hub puis de quay.io) : la prod et la preprod utilisent désormais **RustFS** (`rustfs/rustfs:1.0.1-preview.16`), comme le dev et la CI.

| | Prod | Preprod |
|---|---|---|
| Service Compose | `rustfs` | `rustfs` |
| Conteneur | `badge-rustfs` | `badge-rustfs-preprod` |
| Volume | `badge_rustfs_data` | `badge-preprod_rustfs_data_preprod` |
| Console | `https://s3.badge.bj` | `https://preprod.s3.badge.bj` |
| Ports hôte | aucun | `9002` (API S3), `10001` (console) |

Variables à définir dans `.env.production` / `.env.preprod` (voir `.env.production.example`) :

```dotenv
# container_name, pas l'alias `rustfs` : il est ambigu sur le réseau partagé `badge_web`
S3_ENDPOINT=http://badge-rustfs:9000   # http://badge-rustfs-preprod:9000 en preprod
S3_REGION=us-east-1
S3_BUCKET=badge-prod            # badge-preprod en preprod
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
# Identifiants du conteneur rustfs : mêmes valeurs que S3_ACCESS_KEY / S3_SECRET_KEY
RUSTFS_ACCESS_KEY=...
RUSTFS_SECRET_KEY=...
```

Les anciennes variables `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` ne servent plus. Le bucket est créé par l'app au premier upload.

### Bascule MinIO → RustFS (une seule fois par environnement)

`deploy.sh` ne relance que le service `app` : le conteneur `rustfs` doit être démarré à la main lors de la bascule. Les volumes MinIO ne sont **pas** repris (ils étaient vides).

1. Copier les nouveaux `docker-compose*.yml` et `Caddyfile`, puis mettre à jour le `.env` de l'environnement (variables ci-dessus).
2. Démarrer RustFS et retirer l'ancien conteneur MinIO :
   ```bash
   # Prod (dans ~/prod/badge)
   docker compose up -d --remove-orphans rustfs app
   # Preprod (dans ~/preprod/badge)
   docker compose -f docker-compose.preprod.yml up -d --remove-orphans rustfs app
   ```
3. Recharger Caddy (stack prod) : `docker exec badge-caddy caddy reload --config /etc/caddy/Caddyfile`.
4. Vérifier : `docker ps` montre `badge-rustfs` (healthy), la console répond sur `https://s3.badge.bj`, et un upload depuis l'app fonctionne.
5. Une fois la bascule validée, supprimer les anciens volumes (action irréversible) : `docker volume rm badge_minio_data` (prod) et `docker volume rm badge-preprod_minio_data_preprod` (preprod).

## Initialisation : service `init`

Chaque stack (`docker-compose.yml`, `docker-compose.preprod.yml`) contient un service ponctuel `init`, basé sur l'image `tools`. À chaque `up`, il :

1. pousse le schéma Prisma (`prisma db push --accept-data-loss`) — **seul endroit** où le schéma est synchronisé : ni `deploy.sh` ni `docker-entrypoint.sh` ne le font plus ;
2. lance `prisma/seed-super-admin.ts`, qui crée le SUPER_ADMIN initial **si la base n'en contient aucun** (aucun SUPER_ADMIN non archivé).

`app` dépend de `init` (`service_completed_successfully`) : si `init` échoue, l'app n'est pas relancée et `deploy.sh` s'arrête en erreur. `deploy.sh` nomme explicitement le service (`up -d --no-deps init app`), sinon `--no-deps` ne le démarrerait pas.

Variables lues dans `.env.production` / `.env.preprod` :

```dotenv
SEED_SUPER_ADMIN_EMAIL=admin@badge.exemple.tld
SEED_SUPER_ADMIN_PASSWORD=...   # 6 caractères minimum
SEED_SUPER_ADMIN_NAME=          # optionnel, défaut « Super Admin »
```

- Un SUPER_ADMIN existe déjà (quel que soit son email) : rien n'est fait, les variables ne sont même pas lues.
- Aucun SUPER_ADMIN : le compte est créé (email vérifié, mot de passe hashé, audit `USER_CREATED`).
- Variable email ou mot de passe absente : création ignorée (avertissement), `init` réussit quand même.
- Mot de passe trop court, ou email déjà pris par un compte non SUPER_ADMIN : `init` échoue, le déploiement s'arrête.

Changer le mot de passe après le premier login ; `SEED_SUPER_ADMIN_PASSWORD` peut ensuite être retiré du fichier d'environnement.

Pousser le schéma ou rejouer l'initialisation à la main : `make prod-db-push` / `make preprod-db-push` (équivalent à `docker compose up init`).

Fichiers à recopier sur le serveur après ce changement : `deploy.sh`, `docker-compose.yml` (prod) et `docker-compose.preprod.yml` (preprod). L'entrypoint et le seeder sont dans les images.

## Worker d'emails : service `worker`

Les emails applicatifs passent par une queue MySQL (table `Job`, voir `docs/v4/features/queue-emails.md`). Chaque stack contient un service `worker` qui utilise **la même image que `app`** avec `entrypoint: ["node", "worker.cjs"]` (bundle esbuild copié dans l'image runner par le `Dockerfile`). Il lit `.env.production` / `.env.preprod` et attend `init` et `mysql`.

- `stop_grace_period: 150s` : à l'arrêt (`SIGTERM`), le worker termine les envois en cours.
- Variables optionnelles : `JOB_POLL_INTERVAL_MS` (défaut 2000), `JOB_EMAIL_CONCURRENCY` (défaut 5).
- `deploy.sh` démarre le service (`up -d --no-deps renderer init app worker`) ; `.github/workflows/ci.yml` lance le worker avant les e2e.
- Fichiers à recopier sur le serveur : `deploy.sh`, `docker-compose.yml` (prod) et `docker-compose.preprod.yml` (preprod).
- Rien n'est déployé par ce changement : le worker sera créé à la prochaine release. Sans lui, les emails restent `PENDING` en base.

## Moteur 2.0.0 : service de rendu

Les badges sont rendus en HTML par `@tigamadou/pdf-engine` 2.0.0 ; le PDF, le document figé affiché dans l'aperçu et l'épreuve `proof.png` sont produits par un **service de rendu** (Chromium) : l'image `ghcr.io/tigamadou/pdf-engine-renderer:2.0.0`, publiée en **linux/amd64** seulement (plateforme du VPS). Son tag est toujours égal à la version du moteur (`package.json`), jamais `latest` ; un test (`renderer-version.test.ts`) le vérifie.

| | Prod | Preprod |
|---|---|---|
| Service Compose | `renderer` | `renderer` |
| Conteneur | `badge-renderer` | `badge-renderer-preprod` |
| `RENDERER_URL` | `http://badge-renderer:3000` | `http://badge-renderer-preprod:3000` |

- `RENDERER_URL` est posé par le compose (`environment:` de `app`, `init` et `tools`) : rien à ajouter dans `.env.production` / `.env.preprod`.
- Le service n'est **jamais publié** (aucun `ports:`) et tourne sur un réseau compose `rendu` **interne** (`internal: true`, sans accès sortant) partagé avec `app`, `init` et `tools` seulement : il rend du HTML fourni par l'appelant et ne doit joindre ni Internet ni le réseau de l'hôte.
- `init: true` (Chromium crée des processus enfants) et `stop_grace_period: 30s` (le délai de grâce du service est de 20 s). Santé : le `HEALTHCHECK` de l'image (`GET /health`).
- Service indisponible ou lent : l'aperçu affiche « Aperçu indisponible, réessayer », les routes de rendu et le ZIP répondent 503, l'installation d'un template répond 503.
- Les polices Montserrat sont embarquées dans le moteur : plus d'accès sortant à Google Fonts requis pour le rendu des badges.
- Fichiers à recopier sur le serveur : `deploy.sh`, `docker-compose.yml` (prod) et `docker-compose.preprod.yml` (preprod).

### Procédure de déploiement (préproduction d'abord, cibles `-preprod`)

1. **Sauvegarde** : `make backup-prod` sur le serveur (dump MySQL) ; noter le chemin du dump. Le S3 n'est modifié que par ajout (`proof.png`) : sa sauvegarde n'est pas requise.
2. **Service de rendu** : recopier `deploy.sh`, `docker-compose.yml` / `docker-compose.preprod.yml` ; `docker login ghcr.io` ; `docker compose pull renderer && docker compose up -d renderer` ; contrôle `docker compose ps renderer` → `healthy`.
3. **Vérification préalable** (sans toucher à `app`) : `make verify-engine-prod TAG=sha-<commit>`. Les lignes au format 2 sont migrées en mémoire ; examiner les épreuves `proof-engine-2.0.0.png`. La référence enregistrée par le moteur 1.x n'est pas comparable : tous les templates sont « sans référence ».
4. **Déploiement** : publier la release ; `deploy.sh` tire et relance `renderer`, `init` et `app`. Les badges s'impriment aussitôt (migration en mémoire du format 2).
5. **Migration** : `make migrate-installed-templates-prod` (dry-run), puis `make migrate-installed-templates-prod ARGS=--apply`. Une ligne sautée n'écrit rien en base (code de sortie 1).
6. **Vérification** : `make validate-badge-templates-prod` → `OK` ; `make verify-engine-prod ARGS=--accept` après examen des épreuves ; ouvrir la page d'un badge sur un téléphone ; télécharger un ZIP de lot.

**Retour arrière** : redéployer le tag précédent **et** restaurer le dump (`make rollback-prod SQL=<dump.sql> UPLOADS=<uploads.tar.gz>`) : l'application 1.x ne lit pas le format 3.

Le template ex-305v installé dans badge est à **réinstaller depuis le studio** après le déploiement, pour que le nom du participant tienne sur deux lignes avec repli « A. Nom » puis « Nom » (textes de repli, livrés dans le moteur 2.0.0).
