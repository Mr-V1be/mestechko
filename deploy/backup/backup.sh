#!/bin/sh
# Nightly PostgreSQL backups: a custom-format dump at BACKUP_TIME (server time zone
# TZ), kept BACKUP_KEEP_DAYS days. Restore: see docs/deploy.md, «Резервные копии».
set -eu

: "${PGHOST:?}" "${PGUSER:?}" "${PGDATABASE:?}" "${PGPASSWORD:?}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_TIME="${BACKUP_TIME:-03:30}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

log() {
  printf '{"time":"%s","msg":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"
}

dump() {
  stamp="$(date +%Y%m%d-%H%M)"
  target="${BACKUP_DIR}/${PGDATABASE}-${stamp}.dump"
  pg_dump --format=custom --no-owner --file="${target}.partial"
  mv "${target}.partial" "${target}"
  find "${BACKUP_DIR}" -name "${PGDATABASE}-*.dump" -mtime "+${BACKUP_KEEP_DAYS}" -delete
  log "backup written: $(basename "${target}") ($(du -h "${target}" | cut -f1))"
}

seconds_until() {
  now="$(date +%s)"
  next="$(date -d "$(date +%Y-%m-%d) ${1}:00" +%s)"
  if [ "${next}" -le "${now}" ]; then
    next=$((next + 86400))
  fi
  echo $((next - now))
}

mkdir -p "${BACKUP_DIR}"
if [ "${1:-}" = "now" ]; then
  dump
  exit 0
fi
log "backups at ${BACKUP_TIME}, kept ${BACKUP_KEEP_DAYS} days"
while true; do
  sleep "$(seconds_until "${BACKUP_TIME}")"
  dump || log "backup failed"
done
