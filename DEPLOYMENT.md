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
S3_ENDPOINT=http://rustfs:9000
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
