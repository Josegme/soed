#!/usr/bin/env bash
# Funciones compartidas: PostgreSQL efímero con el shim de Supabase, migraciones
# y seeds. Uso: source scripts/lib/pg-efimero.sh; pg_iniciar; pg_esquema
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PUERTO="${PGPORT_TEST:-54329}"
DATOS="$(mktemp -d)"
SOCKET="$DATOS/socket"
mkdir -p "$SOCKET"
COMO=()
if [ "$(id -u)" = "0" ]; then
  chown -R postgres:postgres "$DATOS"
  COMO=(runuser -u postgres --)
fi
PSQL=("${COMO[@]}" "$PG_BIN/psql" -h "$SOCKET" -p "$PUERTO" -U postgres -v ON_ERROR_STOP=1 -q -X)
export RAIZ PG_BIN PUERTO DATOS SOCKET

pg_detener() {
  "$PG_BIN/pg_ctl" -D "$DATOS/pg" -m immediate stop >/dev/null 2>&1 || "${COMO[@]}" "$PG_BIN/pg_ctl" -D "$DATOS/pg" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATOS"
}

pg_iniciar() {
  "${COMO[@]}" "$PG_BIN/initdb" -D "$DATOS/pg" -U postgres -A trust --no-locale -E UTF8 >/dev/null
  "${COMO[@]}" "$PG_BIN/pg_ctl" -D "$DATOS/pg" -o "-p $PUERTO -k $SOCKET -c listen_addresses='' -c wal_level=logical" -l "$DATOS/pg.log" -w start >/dev/null
  "${PSQL[@]}" -d postgres -c "create database soed_test" >/dev/null
}

pg_esquema() {
  echo "▸ shim de Supabase"
  "${PSQL[@]}" -d soed_test -f "$RAIZ/supabase/tests/shim/supabase_shim.sql" >/dev/null
  echo "▸ migraciones"
  for f in "$RAIZ"/supabase/migrations/*.sql; do
    echo "  · $(basename "$f")"
    "${PSQL[@]}" -d soed_test -f "$f" >/dev/null
  done
  echo "▸ seeds"
  "${PSQL[@]}" -d soed_test -f "$RAIZ/clients/_template/seed.sql" >/dev/null
}
