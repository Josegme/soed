#!/usr/bin/env bash
# Corre migraciones, seeds y pruebas pgTAP sobre un PostgreSQL efímero local.
# Uso: pnpm db:test  (requiere PostgreSQL 16+ con pgTAP: apt install postgresql-16-pgtap)
# Con Supabase CLI y Docker disponibles, la alternativa equivalente es:
#   supabase db reset && supabase test db
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PUERTO="${PGPORT_TEST:-54329}"
DATOS="$(mktemp -d)"
SOCKET="$DATOS/socket"
mkdir -p "$SOCKET"

limpiar() {
  "$PG_BIN/pg_ctl" -D "$DATOS/pg" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATOS"
}
trap limpiar EXIT

# initdb no corre como root: usar el usuario postgres si hace falta.
COMO=()
if [ "$(id -u)" = "0" ]; then
  chown -R postgres:postgres "$DATOS"
  COMO=(runuser -u postgres --)
fi

"${COMO[@]}" "$PG_BIN/initdb" -D "$DATOS/pg" -U postgres -A trust --no-locale -E UTF8 >/dev/null
"${COMO[@]}" "$PG_BIN/pg_ctl" -D "$DATOS/pg" -o "-p $PUERTO -k $SOCKET -c listen_addresses='' -c wal_level=logical" -l "$DATOS/pg.log" -w start >/dev/null

PSQL=("${COMO[@]}" "$PG_BIN/psql" -h "$SOCKET" -p "$PUERTO" -U postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -d postgres -c "create database soed_test" >/dev/null

echo "▸ shim de Supabase"
"${PSQL[@]}" -d soed_test -f "$RAIZ/supabase/tests/shim/supabase_shim.sql" >/dev/null

echo "▸ migraciones"
for f in "$RAIZ"/supabase/migrations/*.sql; do
  echo "  · $(basename "$f")"
  "${PSQL[@]}" -d soed_test -f "$f" >/dev/null
done

echo "▸ seeds"
"${PSQL[@]}" -d soed_test -f "$RAIZ/clients/_template/seed.sql" >/dev/null

if [ -n "${SOED_GENERAR_TIPOS:-}" ]; then
  echo "▸ tipos TypeScript"
  "${COMO[@]}" env PGHOST="$SOCKET" PGPORT="$PUERTO" PGUSER=postgres PGDATABASE=soed_test node "$RAIZ/scripts/gen-db-types.mjs"
  if [ "$(id -u)" = "0" ]; then chown "$(stat -c %u "$RAIZ")":"$(stat -c %g "$RAIZ")" "$RAIZ/packages/shared-types/src/database.types.ts"; fi
  exit 0
fi

echo "▸ pruebas pgTAP"
cd "$RAIZ/supabase/tests/database"
"${COMO[@]}" env PGHOST="$SOCKET" PGPORT="$PUERTO" PGUSER=postgres PGDATABASE=soed_test \
  pg_prove --ext .sql -r . "$@"
