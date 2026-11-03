#!/bin/sh
set -eu

# Script de déploiement sur le VPS, appelé avec: deploy.sh <env> <tag>
ENV=$1
TAG=$2

# Définition des répertoires et fichiers
cd ~/"$ENV"/badge
[ "$ENV" = "prod" ] && F="" || F="-f docker-compose.preprod.yml"
export BADGE_TAG=$TAG

echo "Déploiement de $TAG en $ENV..."

# 1. Pull des nouvelles images
docker compose $F pull renderer app tools

# 1b. Preprod uniquement : base remise a zero puis remplie (seed minimal + demo), app et
# worker arretes pendant l'operation. `set -e` : un echec arrete le deploiement avant la
# relance, jamais d'app sur une base a moitie remplie.
if [ "$ENV" = "preprod" ]; then
  echo "Rechargement de la preprod avec la demo..."
  docker compose $F stop app worker
  if ! docker compose $F run --rm seed-demo; then
    echo "ERREUR : seed-demo a echoue sur $ENV. app et worker restent arretes." >&2
    echo "Corriger la cause puis relancer : docker compose $F run --rm seed-demo, puis deploy.sh $ENV $TAG." >&2
    exit 1
  fi
fi

# 2. Service de rendu, initialisation (db push + SUPER_ADMIN si absent) puis relance
# de l'app. `renderer` et `init` doivent etre nommes explicitement : --no-deps ne les
# demarrerait pas, et `app` attend leur etat (sain / termine avec succes).
docker compose $F up -d --no-deps renderer init app worker

# 3. Nettoyage
docker image prune -f

echo "Déploiement terminé."
