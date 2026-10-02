#!/usr/bin/env bash
# E2E del panel autenticado: PostgreSQL efímero + PostgREST + doble de la API de
# Supabase + `next start` compilado contra ese doble + Playwright (con axe).
# Las sesiones se inyectan como cookie de @supabase/ssr con un JWT del fixture.
set -euo pipefail
source "$(dirname "$0")/lib/pg-efimero.sh"
POSTGREST_BIN="${POSTGREST_BIN:-postgrest}"
PUERTO_PGRST="${PUERTO_PGRST:-54340}"
PUERTO_SUPABASE="${PUERTO_SUPABASE:-54341}"
PUERTO_E2E="${PUERTO_E2E_PANEL:-3200}"
JWT_SECRET="${JWT_SECRET:-soed-e2e-panel-secreto-de-al-menos-32-caracteres}"

limpiar() {
  for pid in "${PID_PGRST:-}" "${PID_SUPABASE:-}"; do [ -n "$pid" ] && kill "$pid" 2>/dev/null || true; done
  pg_detener
}
trap limpiar EXIT
pg_iniciar
pg_esquema

echo "▸ fixture"
"${PSQL[@]}" -d soed_test -c "do \$\$ begin if not exists (select from pg_roles where rolname='authenticator') then create role authenticator login noinherit; end if; end \$\$; grant anon, authenticated, service_role to authenticator;" >/dev/null
"${PSQL[@]}" -d soed_test -f "$RAIZ/supabase/tests/database/000_helpers.sql" >/dev/null
"${PSQL[@]}" -d soed_test -f "$RAIZ/supabase/tests/integracion/fixture.sql" >/dev/null
"${PSQL[@]}" -d soed_test -f "$RAIZ/supabase/tests/e2e/fixture-panel.sql" >/dev/null

echo "▸ PostgREST en :$PUERTO_PGRST y API de Supabase en :$PUERTO_SUPABASE"
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
PGRST_URL="http://127.0.0.1:$PUERTO_PGRST" JWT_SECRET="$JWT_SECRET" PUERTO_SUPABASE="$PUERTO_SUPABASE" node "$RAIZ/scripts/lib/supabase-falso.mjs" &
PID_SUPABASE=$!
for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:$PUERTO_PGRST/" >/dev/null && break; sleep 0.25; done

jwt() { node -e '
const c=require("node:crypto");const b=(v)=>Buffer.from(v).toString("base64url");
const h=b(JSON.stringify({alg:"HS256",typ:"JWT"}));const p=b(JSON.stringify({role:process.argv[1],iss:"soed-e2e",exp:Math.floor(Date.now()/1000)+86400}));
console.log(h+"."+p+"."+c.createHmac("sha256",process.argv[2]).update(h+"."+p).digest("base64url"));' "$1" "$JWT_SECRET"; }

cd "$RAIZ/apps/web"
export NEXT_DIST_DIR=".next-e2e"
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$PUERTO_SUPABASE"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(jwt anon)"
export SUPABASE_SECRET_KEY="$(jwt service_role)"
export NEXT_PUBLIC_SITE_URL="http://localhost:$PUERTO_E2E"
if [ -z "${SIN_BUILD:-}" ]; then
  echo "▸ next build (.next-e2e)"
  pnpm exec next build >"$DATOS/build.log" 2>&1 || { tail -40 "$DATOS/build.log"; exit 1; }
fi

echo "▸ Playwright (panel)"
PGHOST="$SOCKET" PGPORT="$PUERTO" PGUSER=postgres PGDATABASE=soed_test JWT_SECRET="$JWT_SECRET" PUERTO_E2E_PANEL="$PUERTO_E2E" \
  pnpm exec playwright test -c playwright.panel.config.ts "$@"
