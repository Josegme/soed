#!/usr/bin/env bash
# Pruebas de integración: PostgREST real sobre el esquema migrado, consumido por
# los adaptadores de infraestructura vía supabase-js (Vitest).
# Requiere: PostgreSQL 16 + pgTAP y el binario `postgrest` (POSTGREST_BIN).
set -euo pipefail
source "$(dirname "$0")/lib/pg-efimero.sh"
POSTGREST_BIN="${POSTGREST_BIN:-postgrest}"
PUERTO_PGRST="${PUERTO_PGRST:-54330}"
JWT_SECRET="${JWT_SECRET:-soed-integracion-secreto-de-al-menos-32-caracteres}"

limpiar() { [ -n "${PID_PGRST:-}" ] && kill "$PID_PGRST" 2>/dev/null || true; pg_detener; }
trap limpiar EXIT
pg_iniciar
pg_esquema

echo "▸ rol authenticator y fixture"
"${PSQL[@]}" -d soed_test -c "do \$\$ begin if not exists (select from pg_roles where rolname='authenticator') then create role authenticator login noinherit; end if; end \$\$; grant anon, authenticated, service_role to authenticator;" >/dev/null
"${PSQL[@]}" -d soed_test -f "$RAIZ/supabase/tests/database/000_helpers.sql" >/dev/null
"${PSQL[@]}" -d soed_test -f "$RAIZ/supabase/tests/integracion/fixture.sql" >/dev/null

echo "▸ PostgREST en :$PUERTO_PGRST"
cat > "$DATOS/postgrest.conf" <<CONF
db-uri = "postgres://authenticator@/soed_test?host=$SOCKET&port=$PUERTO"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = $PUERTO_PGRST
server-host = "127.0.0.1"
log-level = "error"
CONF
chmod 644 "$DATOS/postgrest.conf"
"${COMO[@]}" "$POSTGREST_BIN" "$DATOS/postgrest.conf" > "$DATOS/postgrest.log" 2>&1 &
PID_PGRST=$!
for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:$PUERTO_PGRST/" >/dev/null && break; sleep 0.25; done

echo "▸ Vitest (integración)"
cd "$RAIZ/apps/web"
PGRST_URL="http://127.0.0.1:$PUERTO_PGRST" JWT_SECRET="$JWT_SECRET" \
  PGHOST="$SOCKET" PGPORT="$PUERTO" PGUSER=postgres PGDATABASE=soed_test \
  pnpm exec vitest run --config vitest.integracion.config.ts "$@"
