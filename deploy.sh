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
docker compose $F pull app tools

# 2. Application des migrations via tools
docker compose $F run --rm tools npx prisma db push --accept-data-loss # WARNING: using push, better migrate

# 3. Relance de l'app sans coupure (no-deps, upattend que le healthcheck passe)
docker compose $F up -d --no-deps app

# 4. Nettoyage
docker image prune -f

echo "Déploiement terminé."
