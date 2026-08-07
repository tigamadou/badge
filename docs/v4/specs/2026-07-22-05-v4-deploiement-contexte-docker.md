# Spec v4 — Déploiement par contexte Docker SSH

> **Statut** : conception validée — 2026-07-22 — **à implémenter**
> **Type** : refonte d'infrastructure (déploiement)
> **Périmètre** : v4

## Contexte et objectifs

Le déploiement actuel (`make deploy-prod` / `make deploy-preprod`) repose sur un **rsync du dépôt complet** vers deux checkouts distincts sur le serveur (`~/prod/badge`, `~/preprod/badge`), suivi d'un `ssh … make prod-build` qui builde l'image sur place. Trois problèmes :

1. **Plusieurs fichiers d'environnement par serveur.** Chaque dossier reçoit son propre `.env.*`, mais les deux stacks cohabitent sur la même machine : deux jeux de secrets de production sont présents sur le disque, et le seul garde-fou est une paire d'`--exclude` rsync dont l'oubli est silencieux.
2. **Plusieurs fichiers Compose par serveur.** Les trois `docker-compose*.yml` (dont celui de dev) sont rsyncés dans chaque dossier. Rien n'empêche de lancer la mauvaise stack depuis le mauvais dossier.
3. **Tout le code source vit sur le serveur.** Alors que seule l'image compte à l'exécution, le serveur héberge en permanence deux copies complètes du dépôt (`src/`, `e2e/`, `docs/`, `.yarn/`, `prisma/`…), plus les `node_modules` générés par le build.

Cette spec définit un déploiement où **rien d'autre que les images et les volumes ne persiste sur le serveur**, sans introduire de container registry distant.

## Décisions tranchées (synthèse ADR)

| Sujet | Décision | Pourquoi |
|---|---|---|
| Mécanisme de déploiement | Contexte Docker SSH (`docker --context badge compose …`) piloté depuis le Mac | Compose lit les fichiers `-f` et `env_file` **localement** et n'envoie au démon distant que la configuration résolue. Ni compose, ni `.env`, ni source n'atterrit sur le serveur. Aucune brique d'infra supplémentaire. |
| Lieu du build | Sur le serveur, via le contexte | Le Mac est arm64, le serveur amd64. Builder localement imposerait une émulation QEMU sur un build Next.js (plusieurs dizaines de minutes). Le contexte de build est streamé, BuildKit ne conserve que les layers — la source ne persiste pas. |
| Alternative écartée : `docker save` \| `docker load` | Non retenue | Résout le cross-build par l'émulation QEMU et transfère l'image entière (~200-400 Mo) à chaque déploiement, sans dédup de layers. |
| Alternative écartée : registry auto-hébergé | Non retenue | Donnerait les meilleurs transferts incrémentaux, mais ajoute un composant à exploiter et ne règle pas le cross-build arm64→amd64. |
| Alternative écartée : build en CI | Non retenue | Runner amd64 correct, mais transfert d'artefact lourd et dépendance à GitHub sur le chemin critique du déploiement. |
| Structure Compose | Base commune + deux overrides courts (`-f docker-compose.yml -f compose/<env>.yml`) | Supprime la duplication actuelle entre `docker-compose.yml` et `docker-compose.preprod.yml` sans imposer le renommage de volumes qu'entraînerait un fichier unique paramétré. |
| Nommage des volumes | Clés courtes en base, **noms réels épinglés** via `name:` dans l'override preprod | Le nom réel d'un volume est `<projet>_<clé>`. L'épinglage garantit zéro migration de données sur les deux environnements. |
| Tags d'image | `badge-app:prod` / `badge-app:preprod` (idem `tools`, `caddy`) | Un build de preprod ne doit jamais écraser l'image servant la production. |
| Caddyfile | Baké dans une image `Dockerfile.caddy` | Un bind mount `./Caddyfile` se résoudrait **sur le serveur**, où le fichier n'existe plus. Baker la config est cohérent avec « on ne déploie que des images ». Le reload à chaud reste possible via `docker cp` + `caddy reload` à travers le contexte. |
| Surface du Makefile | `deploy-prod` et `deploy-preprod` uniquement pour le distant | Un seul mode opératoire. Les opérations rares sont documentées en commandes brutes plutôt qu'encapsulées dans des cibles rarement relues. |
| `prisma db push` | Aucune cible ni étape dédiée | Correction du 2026-07-22, à la rédaction du plan : `docker-entrypoint.sh` exécute déjà `prisma db push --accept-data-loss` à chaque démarrage du conteneur `app`. L'ancienne cible `prod-db-push` était redondante. Les cibles `deploy-*` se réduisent donc à `up -d --build`. |
| Hors-scope | Pipeline de backups chiffrés (spec `2026-05-31-v4-stockage-s3-et-backups.md`), CI de déploiement | Voir « Impacts sur les travaux en cours ». |

## Architecture cible

### Contexte Docker unique

Prod et preprod tournent sur la **même machine** (`173.212.217.54`). Un seul contexte suffit :

```
docker context create badge --docker "host=ssh://root@173.212.217.54"
```

Toutes les commandes distantes deviennent `docker --context badge …`. Pré-requis : authentification SSH par clé (déjà en place, `rsync`/`ssh` fonctionnent aujourd'hui) et le client Docker sur le Mac (présent).

### Ce qui change

| Aspect | Avant | Après |
|---|---|---|
| Code sur le serveur | checkout complet ×2 | aucun |
| Fichiers `.env` sur le serveur | `.env.production` + `.env.preprod` | aucun |
| Fichiers Compose sur le serveur | 3 rsyncés par dossier | aucun |
| Build | `ssh … make prod-build` | `--build` via le contexte, contexte streamé |
| Persistant sur le serveur | volumes + images + source + secrets | volumes + images |

### Arborescence des fichiers

```
docker-compose.yml         # base commune prod/preprod : app, mysql, phpmyadmin, minio, tools
compose/prod.yml           # name: badge         + caddy + container_name + ports + env_file
compose/preprod.yml        # name: badge-preprod + ports debug + volumes épinglés
docker-compose.dev.yml     # inchangé
Dockerfile                 # inchangé
Dockerfile.caddy           # nouveau : FROM caddy:2-alpine + COPY Caddyfile
Caddyfile                  # inchangé, désormais baké au lieu d'être bind-monté
```

`docker-compose.preprod.yml` est supprimé, son contenu se répartissant entre la base et `compose/preprod.yml`.

### Répartition base / overrides

La **base** porte tout ce qui est identique entre les deux environnements : `build`, `image` de base, `expose`, `command`, `healthcheck`, `depends_on`, `restart`, `profiles`, le mapping des volumes et les variables non sensibles (`MYSQL_DATABASE`, `PMA_HOST`…). Elle ne déclare **ni** `container_name`, **ni** `ports`, **ni** `env_file`, **ni** rattachement réseau explicite.

Les **overrides** portent ce qui diffère : `name:` du projet, `container_name` de chaque service, `ports` publiés, `env_file`, `MINIO_BROWSER_REDIRECT_URL`, rattachement au réseau `web`, tags d'image, et — côté prod uniquement — le service `caddy`.

`caddy` reste exclusivement dans `compose/prod.yml` : il est l'unique reverse proxy de l'hôte (seul détenteur de 80/443) et sert déjà les domaines `preprod.*` via le réseau partagé `badge_web`. Ce fonctionnement est inchangé.

### Volumes — aucune migration

Le nom réel d'un volume Docker créé par Compose est `<nom_de_projet>_<clé>`.

**Prod** : le projet vaut aujourd'hui `badge` (nom du dossier serveur `~/prod/badge`). En figeant `name: badge` dans `compose/prod.yml` et en gardant les clés `mysql_data`, `uploads_data`, `minio_data`, `caddy_data`, `caddy_config`, les noms réels restent `badge_mysql_data`, `badge_uploads_data`, etc. — identiques à l'existant.

**Preprod** : le projet vaut `badge-preprod` et les clés actuelles sont suffixées (`mysql_data_preprod`), donnant `badge-preprod_mysql_data_preprod`. Comme la base utilise désormais les clés courtes, l'override épingle explicitement les noms réels :

```yaml
volumes:
  mysql_data:
    name: badge-preprod_mysql_data_preprod
  uploads_data:
    name: badge-preprod_uploads_data_preprod
  minio_data:
    name: badge-preprod_minio_data_preprod
```

Résultat : **aucun volume n'est renommé sur aucun des deux environnements**, donc aucune migration de données.

### Résolution des chemins relatifs

Avec plusieurs `-f`, Compose fixe le **répertoire de projet** au dossier du **premier** fichier. `docker-compose.yml` étant à la racine, les chemins relatifs déclarés dans `compose/prod.yml` (`env_file: .env.production`, `build.context: .`) se résolvent bien depuis la racine du dépôt, pas depuis `compose/`. Ce point doit être vérifié explicitement à l'implémentation : c'est un piège classique et une erreur ici se manifeste par un conteneur démarré sans ses variables.

### Interpolation et `--env-file`

Compose charge automatiquement `./.env` (l'environnement de **dev**) comme source d'interpolation. Passer `--env-file .env.production` **remplace** cette source, ce qui évite qu'une variable de dev fuite dans la configuration résolue d'un environnement distant. Le flag est un flag de niveau `compose`, il se place avant la sous-commande.

## Le nouveau Makefile

```makefile
SERVER       = root@173.212.217.54
DOCKER_CTX   = badge
DOCKER       = docker --context $(DOCKER_CTX)
COMPOSE_PROD = $(DOCKER) compose -f docker-compose.yml -f compose/prod.yml    --env-file .env.production
COMPOSE_PREP = $(DOCKER) compose -f docker-compose.yml -f compose/preprod.yml --env-file .env.preprod

deploy-prod: ctx-check
	$(COMPOSE_PROD) up -d --build

deploy-preprod: ctx-check
	$(COMPOSE_PREP) up -d --build
```

Le schéma Prisma est synchronisé par `docker-entrypoint.sh` au démarrage du conteneur `app` : aucune étape dédiée n'est nécessaire dans les cibles.

`ctx-check` est une cible **interne**, idempotente et silencieuse : elle crée le contexte Docker s'il n'existe pas, puis le réseau externe `badge_web` s'il manque. Elle remplace `net-create` et n'est pas destinée à être appelée à la main.

### Cibles supprimées

| Catégorie | Cibles |
|---|---|
| Cycle prod | `prod`, `prod-build`, `prod-down`, `prod-logs`, `prod-db-push`, `prod-db-reset` |
| Cycle preprod | `preprod`, `preprod-build`, `preprod-down`, `preprod-logs`, `preprod-db-push`, `preprod-db-reset` |
| Transfert | `upload`, `upload-prod`, `upload-preprod`, `upload-prod-dry`, `upload-preprod-dry`, `deploy`, `download-uploads`, `download-db` |
| Exploitation | `backup-prod`, `rollback-prod`, `migrate-uploads-clear`, `smoke-tests`, `smoke-tests-preprod` |
| Caddy distant | `caddy-reload`, `caddy-check`, `caddy-logs` |
| Variables devenues mortes | `PROD_DIR`, `PREPROD_DIR`, `PREPROD_COMPOSE`, `RSYNC`, `RSYNC_EXCLUDES`, `BACKUP_DIR`, `TS`, `net-create` |

### Cibles conservées

Toutes les cibles de développement (`dev*`, `test*`, `lint`, `typecheck`, `build`, `logs`, `db-*`, `validate-badge-templates`) sont inchangées. `caddy-validate` et `caddy-fmt` sont conservées : elles s'exécutent en local (`docker run` sur le démon local) et ne touchent aucun environnement distant.

## Documentation d'exploitation

Les équivalents des cibles supprimées sont documentés en commandes brutes dans `docs/v4/installation.md`, nouvelle section « Exploitation des environnements distants ». Sans cette documentation, on perd notamment la procédure de rollback, seul filet de sécurité après un déploiement raté. Elle couvre au minimum :

- **Logs** : `docker --context badge logs -f badge-app`
- **Arrêt d'une stack** : `docker --context badge compose -f … down`
- **Reload Caddy à chaud, sans coupure** :
  ```
  docker --context badge cp Caddyfile badge-caddy:/etc/caddy/Caddyfile
  docker --context badge exec badge-caddy caddy reload --config /etc/caddy/Caddyfile
  ```
- **Vérification des upstreams** : équivalent de l'ancien `caddy-check`, en boucle `wget` depuis le conteneur Caddy.
- **Dump SQL rapatrié sur le Mac** : `docker --context badge exec badge-db sh -c 'mysqldump …' > backups/…sql`
- **Archive uploads rapatriée sur le Mac** : `docker --context badge run --rm -v badge_uploads_data:/data alpine tar -czf - -C /data . > backups/…tar.gz`
- **Restauration** : réinjection par `docker --context badge exec -i`, avec les mêmes garde-fous de confirmation que l'ancien `rollback-prod`.
- **Smoke tests** : `docker --context badge compose -f … run --rm tools yarn tsx scripts/smoke-tests.ts`

Ces commandes fonctionnent à travers le contexte SSH : `docker cp`, `exec -i` et la redirection de sortie streament bien de bout en bout. Effet de bord bénéfique : les dumps et archives atterrissent désormais **sur le Mac** et non plus à côté de la production.

## Corrections embarquées

### Fuite de secrets dans l'image `tools`

`.dockerignore` exclut `.env` et `.env*.local` mais **pas** `.env.production` ni `.env.preprod`. Le stage `builder` du `Dockerfile` fait `COPY . .` — l'image `tools`, construite sur ce stage, embarque donc aujourd'hui les secrets des **deux** environnements. Correction : ajouter `.env.production` et `.env.preprod` à `.dockerignore`.

### Durcissement du contexte de build

Le contexte de build part maintenant du Mac. Les dossiers `uploads/`, `backups/`, `coverage/` et `.plan-logs/` étaient exclus par `RSYNC_EXCLUDES` — variable supprimée — et ne sont exclus par personne d'autre. Sans ajout à `.dockerignore`, chaque build streame potentiellement des centaines de Mo inutiles par SSH.

### `.env.production` obsolète — bloquant pour la bascule prod

Constat du 2026-07-22 : `.env.production` est resté à l'ère v1/v2. Le code v4 lit `BASE_URL`, `PLATFORM_SMTP_*` (6 clés), `S3_*` (5 clés) et `UPLOAD_TOKEN_SECRET` — **aucune n'y figure**. `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`, consommées par le conteneur MinIO, manquent également : le MinIO de production tourne donc avec les identifiants par défaut. À l'inverse, le fichier porte huit clés que le code ne lit plus (`SMTP_*`, `RECAPTCHA_SITE_KEY`, `SEED_ADMIN_*`). `.env.preprod` est à jour.

Cette dette est antérieure à la présente refonte, mais elle bloque la bascule de production : elle fait l'objet d'une tâche dédiée dans le plan, exigeant des valeurs secrètes que seul l'utilisateur peut fournir.

### MySQL exposé publiquement

`docker-compose.yml` publie aujourd'hui `3306:3306` sur le service `mysql` de production, c'est-à-dire **sur l'IP publique du serveur** ; la preprod fait de même sur `33061`. Aucun consommateur externe n'est identifié : `app` et `phpmyadmin` joignent `mysql` par le réseau Docker interne.

Décision (2026-07-22) : le `ports` est remplacé par un `expose` sur les deux environnements, dans le périmètre de cette spec. Les stacks étant de toute façon recréées par la bascule, c'est le moment naturel pour le faire. L'accès direct à la base depuis le Mac reste possible par tunnel SSH (`ssh -L 3307:localhost:3306 root@…`) ou via phpMyAdmin derrière Caddy.

## Impacts sur les travaux en cours

La spec `2026-05-31-v4-stockage-s3-et-backups.md` (pipeline de backups hebdomadaires, **non implémentée**) prévoit un cron de l'hôte appelant `make backup-prod` depuis `~/prod/badge`. Ces deux prémisses disparaissent : plus de `make backup-prod`, plus de checkout serveur. Cette spec-là devra être révisée pour reposer soit sur un script embarqué dans l'image et déclenché via le contexte, soit sur un cron serveur invoquant directement des commandes `docker`. La révision est **hors-scope ici** ; il suffit d'ajouter une note de périmètre dans la spec concernée.

## Plan de bascule

L'ordre est contraint : on valide sur preprod avant de toucher à la production, et on ne détruit rien avant d'avoir validé les deux.

1. Créer le contexte Docker et vérifier la connectivité (`docker --context badge ps`).
2. Écrire la base, les deux overrides et `Dockerfile.caddy` ; durcir `.dockerignore`.
3. Vérifier la configuration résolue **sans rien démarrer**, sur les deux environnements : `docker compose -f … config`. Contrôler nommément les noms de volumes, les `container_name`, les ports et la présence des variables d'environnement attendues.
4. Réécrire le Makefile.
5. Déployer la **preprod** par le nouveau chemin. Vérifier : conteneurs sains, données préservées (volumes non recréés), `preprod.badge.bj` servi par Caddy, smoke tests verts.
6. Déployer la **prod**. Mêmes vérifications sur `badge.bj`.
7. Rapatrier `~/prod/badge/backups/` sur le Mac.
8. **Seulement après validation des deux environnements**, proposer à l'utilisateur la suppression de `~/prod/badge` et `~/preprod/badge`. Cette suppression n'est jamais automatique.

## Vérification

Ce changement ne touche aucun code applicatif : `lint`, `typecheck` et la suite Vitest ne le couvrent pas. La vérification est opérationnelle et repose sur les étapes 3, 5 et 6 du plan de bascule. Le critère d'acceptation global :

- Un déploiement complet des deux environnements réussit depuis le Mac, sans SSH manuel.
- `ls ~/prod ~/preprod` sur le serveur ne montre plus aucun fichier du dépôt (après nettoyage).
- Aucun `.env` ni `docker-compose*.yml` n'est présent sur le serveur.
- Les données de prod et de preprod (BDD, uploads, bucket MinIO) sont intactes.
- `docker --context badge images` montre des tags `:prod` et `:preprod` distincts.

## Risques

| Risque | Mitigation |
|---|---|
| Erreur de fusion base/override → conteneur démarré sans ses variables | Étape 3 obligatoire : `docker compose config` inspecté avant tout `up`, sur les deux environnements. |
| Volume recréé vide au lieu d'être réutilisé | Noms épinglés dans l'override preprod ; contrôle des noms dans la sortie de `config` ; `docker volume ls` avant/après. |
| Transfert du contexte de build lent par SSH | `.dockerignore` durci ; le cache de layers reste sur le serveur, donc les builds suivants ne restreament que le delta. |
| Perte des procédures d'exploitation avec les cibles supprimées | La documentation `docs/v4/installation.md` est livrée **dans le même changement**, pas après. |
| Suppression prématurée des dossiers serveur | Étape 8 conditionnée à la validation des deux environnements et à une confirmation explicite de l'utilisateur. |
