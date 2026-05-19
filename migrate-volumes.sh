#!/bin/bash
set -euo pipefail

echo "=== Migration des volumes Docker vers des bind mounts ==="

# Vérifier que les conteneurs sont arrêtés
echo "Arrêt des conteneurs..."
docker compose down

# Créer les dossiers de destination
echo "Création des dossiers data/uploads et data/mysql..."
sudo mkdir -p /var/lib/investiture/uploads
sudo mkdir -p /var/lib/investiture/mysql

# Copier les données du volume uploads_data
echo "Copie de uploads_data -> /var/lib/investiture/uploads..."
docker run --rm \
  -v investiture_uploads_data:/source:ro \
  -v /var/lib/investiture/uploads:/dest \
  alpine sh -c "cp -a /source/. /dest/"

# Copier les données du volume mysql_data
echo "Copie de mysql_data -> /var/lib/investiture/mysql..."
docker run --rm \
  -v investiture_mysql_data:/source:ro \
  -v /var/lib/investiture/mysql:/dest \
  alpine sh -c "cp -a /source/. /dest/"

echo ""
echo "=== Migration terminée ==="
echo "Les données ont été copiées dans /var/lib/investiture/uploads et /var/lib/investiture/mysql"
echo ""
echo "Prochaines étapes :"
echo "  1. Vérifier que les données sont bien dans /var/lib/investiture/"
echo "  2. Mettre à jour docker-compose.yml (déjà fait si vous avez appliqué les changements)"
echo "  3. Relancer : docker compose up -d"
echo "  4. Vérifier que tout fonctionne"
echo "  5. Supprimer les anciens volumes : docker volume rm investiture_uploads_data investiture_mysql_data"
