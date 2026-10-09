#!/bin/sh
set -e

# Le schema est synchronise par le service compose `init` avant le demarrage.
echo "Starting application..."
exec node server.js
