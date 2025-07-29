#!/bin/bash

DB_HOST="localhost"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="thingsboard"

BACKUP_DIR="/var/backups/thingsboard"
BACKUP_FILE="$BACKUP_DIR/thingsboard_$(date +%Y%m%d_%H%M%S).sql"
# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

export PGPASSWORD="$DB_PASSWORD"
pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"

# Option 2: Using docker image
# docker run \
#     -v .:/app/ \
#     -v thingsboard_postgres_data:/var/lib/postgresql/data \
#     --network host postgres:16 \
#     bash -c "export PGPASSWORD=\"$DB_PASSWORD\" && pg_dump -h $DB_HOST -U $DB_USER $DB_NAME" \
#     > "$BACKUP_FILE"
