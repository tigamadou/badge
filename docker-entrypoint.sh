#!/bin/sh
set -e

echo "Running database migrations..."
prisma db push

echo "Starting application..."
exec node server.js
