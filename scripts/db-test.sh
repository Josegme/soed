#!/usr/bin/env bash
# Corre migraciones, seeds y pruebas pgTAP sobre un PostgreSQL efímero local.
# Uso: pnpm db:test  (requiere PostgreSQL 16+ con pgTAP: apt install postgresql-16-pgtap)
# Con Supabase CLI y Docker disponibles, la alternativa equivalente es:
#   supabase db reset && supabase test db
set -euo pipefail
source "$(dirname "$0")/lib/pg-efimero.sh"
trap pg_detener EXIT
pg_iniciar
pg_esquema

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
