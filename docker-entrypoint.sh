#!/bin/sh
set -e

echo "Running database migrations..."
prisma db push --accept-data-loss

echo "Starting application..."
exec node server.js
