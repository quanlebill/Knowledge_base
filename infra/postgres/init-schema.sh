#!/bin/bash
set -e

echo ">>> Running Alembic migrations on dataagent..."
cd /app
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost/${POSTGRES_DB}" \
    alembic upgrade head

echo ">>> Seeding dataagent..."
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /migrations/seed.sql

echo ">>> DB init complete."
