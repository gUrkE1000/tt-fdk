#!/usr/bin/env bash
#
# Lokale Test-Datenbank für den Vereinsplaner.
#
# Hintergrund: In der Entwicklungsumgebung steht kein Docker und damit kein `supabase start`
# zur Verfügung. Dieses Skript zieht stattdessen eine native PostgreSQL-Instanz hoch, spielt
# die Supabase-Kompatibilitätsschicht ein (scripts/supabase-compat.sql) und danach alle
# Migrationen. Dieselben Migrationen und Tests laufen unverändert gegen eine echte
# Supabase-Instanz — siehe docs/entwicklung.md.
#
#   ./scripts/local-db.sh start    Cluster starten (idempotent)
#   ./scripts/local-db.sh reset    Datenbank neu aufbauen: Compat + Migrationen + Seed
#   ./scripts/local-db.sh test     pgTAP-Tests aus supabase/tests/ ausführen
#   ./scripts/local-db.sh psql     Interaktive Konsole
#   ./scripts/local-db.sh url      Verbindungs-URL ausgeben (für gen:types)
#
# Konfiguration über Umgebungsvariablen:
#   PGHOST (127.0.0.1) · PGPORT (5432) · PGUSER (postgres) · PGPASSWORD (postgres)
#   DB_NAME (vereinsplaner)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
DB_NAME="${DB_NAME:-vereinsplaner}"
export PGHOST PGPORT PGUSER PGPASSWORD

DB_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${DB_NAME}"

log()  { printf '\033[0;36m→\033[0m %s\n' "$*"; }
ok()   { printf '\033[0;32m✓\033[0m %s\n' "$*"; }
fail() { printf '\033[0;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# NOTICE-Meldungen (z. B. "policy does not exist, skipping" bei idempotenten Migrationen)
# unterdrücken; WARNING und ERROR bleiben sichtbar.
export PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}"

# psql gegen die Wartungsdatenbank (zum Anlegen/Löschen von DB_NAME)
psql_maint() { psql -v ON_ERROR_STOP=1 -q -d postgres "$@"; }
# psql gegen die Projektdatenbank
psql_db()    { psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" "$@"; }

# Sorgt dafür, dass PGUSER sich per Passwort über TCP anmelden kann. Auf einem lokalen
# Debian/Ubuntu-Cluster ist nur peer-Authentifizierung als OS-Benutzer postgres eingerichtet;
# in der CI übernimmt das der Service-Container, dort ist das hier ein No-op.
ensure_password() {
  id postgres >/dev/null 2>&1 || return 0   # CI: Service-Container bringt das Passwort mit

  local -a as_postgres
  if command -v runuser >/dev/null 2>&1; then
    as_postgres=(runuser -u postgres --)
  elif command -v sudo >/dev/null 2>&1; then
    as_postgres=(sudo -u postgres)
  else
    return 0
  fi

  # Bewusst über den Unix-Socket und ohne PGPASSWORD: über TCP bräuchte dieser Aufruf
  # genau das Passwort, das er gerade erst setzen soll.
  "${as_postgres[@]}" env PGHOST=/var/run/postgresql "PGPORT=${PGPORT}" PGPASSWORD= \
    psql -q -c "ALTER ROLE ${PGUSER} WITH PASSWORD '${PGPASSWORD}'" >/dev/null 2>&1 || true
}

cmd_start() {
  if pg_isready -q -h "$PGHOST" -p "$PGPORT" 2>/dev/null; then
    ensure_password
    ok "PostgreSQL läuft bereits auf ${PGHOST}:${PGPORT}"
    return 0
  fi

  if command -v pg_ctlcluster >/dev/null 2>&1; then
    log "Starte Cluster 16/main"
    pg_ctlcluster 16 main start 2>/dev/null || true
  elif command -v service >/dev/null 2>&1; then
    service postgresql start >/dev/null 2>&1 || true
  fi

  for _ in $(seq 1 20); do
    pg_isready -q -h "$PGHOST" -p "$PGPORT" 2>/dev/null && break
    sleep 0.5
  done

  pg_isready -q -h "$PGHOST" -p "$PGPORT" 2>/dev/null \
    || fail "PostgreSQL ist auf ${PGHOST}:${PGPORT} nicht erreichbar."

  ensure_password
  ok "PostgreSQL bereit auf ${PGHOST}:${PGPORT}"
}

cmd_reset() {
  cmd_start

  log "Lege Datenbank ${DB_NAME} neu an"
  psql_maint -c "DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)" >/dev/null
  psql_maint -c "CREATE DATABASE ${DB_NAME}" >/dev/null

  log "Spiele Supabase-Kompatibilitätsschicht ein"
  psql_db -f "${ROOT_DIR}/scripts/supabase-compat.sql" >/dev/null

  local count=0
  shopt -s nullglob
  for migration in "${ROOT_DIR}"/supabase/migrations/*.sql; do
    log "Migration $(basename "$migration")"
    psql_db -f "$migration" >/dev/null
    count=$((count + 1))
  done

  if [ -f "${ROOT_DIR}/supabase/seed.sql" ]; then
    log "Seed-Daten"
    psql_db -f "${ROOT_DIR}/supabase/seed.sql" >/dev/null
  fi
  shopt -u nullglob

  ok "Datenbank ${DB_NAME} aufgebaut (${count} Migrationen)"
}

cmd_test() {
  cmd_start

  shopt -s nullglob
  local files=("${ROOT_DIR}"/supabase/tests/*.sql)
  shopt -u nullglob

  if [ ${#files[@]} -eq 0 ]; then
    ok "Keine pgTAP-Tests vorhanden — übersprungen"
    return 0
  fi

  command -v pg_prove >/dev/null 2>&1 \
    || fail "pg_prove fehlt. Installation: apt-get install -y postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl"

  log "Führe ${#files[@]} pgTAP-Testdateien aus"
  pg_prove --ext .sql -d "$DB_NAME" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "${files[@]}"
  ok "pgTAP-Tests grün"
}

cmd_psql() { cmd_start; exec psql -d "$DB_NAME"; }
cmd_url()  { printf '%s\n' "$DB_URL"; }

case "${1:-}" in
  start) cmd_start ;;
  reset) cmd_reset ;;
  test)  cmd_test ;;
  psql)  cmd_psql ;;
  url)   cmd_url ;;
  *)
    cat >&2 <<USAGE
Verwendung: $0 {start|reset|test|psql|url}

  start   PostgreSQL-Cluster starten (idempotent)
  reset   Datenbank neu aufbauen: Kompatibilitätsschicht, Migrationen, Seed
  test    pgTAP-Tests aus supabase/tests/ ausführen
  psql    Interaktive Konsole
  url     Verbindungs-URL ausgeben
USAGE
    exit 1
    ;;
esac
