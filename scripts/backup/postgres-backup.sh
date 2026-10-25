#!/usr/bin/env sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
mkdir -p "${BACKUP_DIR:-./backups}"
out="${BACKUP_DIR:-./backups}/family_network_$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump "$DATABASE_URL" --format=custom --file="$out"
echo "backup written to $out"
