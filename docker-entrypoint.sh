#!/bin/sh
set -e

echo "Running database migrations..."
# WARNING: Removed --accept-data-loss to prevent accidental data deletion in production.
prisma db push

echo "Starting application..."
exec node server.js
