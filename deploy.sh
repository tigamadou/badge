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

# 2. Initialisation (db push + SUPER_ADMIN si absent) puis relance de l'app.
# `init` doit etre nomme explicitement : --no-deps ne le demarrerait pas, et
# `app` attend qu'il se termine avec succes (un echec bloque la relance).
docker compose $F up -d --no-deps init app

# 3. Nettoyage
docker image prune -f

echo "Déploiement terminé."
