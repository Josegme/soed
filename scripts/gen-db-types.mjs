#!/usr/bin/env node
// Genera packages/shared-types/src/database.types.ts desde el catálogo de una
// base PostgreSQL con las migraciones aplicadas, en el mismo formato que
// `supabase gen types typescript`. Permite tipar el cliente sin Docker.
// Uso: SOED_GENERAR_TIPOS=1 bash scripts/db-test.sh   (o con PG* apuntando a una base)
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const psql = (sql) =>
  JSON.parse(execFileSync('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim() || '[]');

const columnas = psql(`
  select coalesce(json_agg(x order by x.tabla, x.nombre), '[]') from (
    select c.relname as tabla, c.relkind as tipo, a.attname as nombre,
           format_type(a.atttypid, a.atttypmod) as pgtipo,
           not a.attnotnull as nulable,
           (a.atthasdef or a.attidentity <> '' or a.attgenerated <> '') as con_default,
           a.attidentity = 'a' or a.attgenerated <> '' as solo_lectura
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'v') and a.attnum > 0 and not a.attisdropped
  ) x`);

const relaciones = psql(`
  select coalesce(json_agg(x order by x.tabla, x.nombre), '[]') from (
    select con.conname as nombre, src.relname as tabla, dst.relname as referenciada,
           (select array_agg(a.attname order by k.ord) from unnest(con.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as columnas,
           (select array_agg(a.attname order by k.ord) from unnest(con.confkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum) as columnas_ref,
           exists (select 1 from pg_index i where i.indrelid = con.conrelid and i.indisunique
                    and i.indkey::int2[] @> con.conkey and i.indkey::int2[] <@ con.conkey) as uno_a_uno
      from pg_constraint con
      join pg_class src on src.oid = con.conrelid
      join pg_class dst on dst.oid = con.confrelid
      join pg_namespace n on n.oid = src.relnamespace
      join pg_namespace nd on nd.oid = dst.relnamespace
     where con.contype = 'f' and n.nspname = 'public' and nd.nspname = 'public'
  ) x`);

const funciones = psql(`
  select coalesce(json_agg(x order by x.nombre), '[]') from (
    select p.proname as nombre,
           coalesce(p.proargnames, '{}') as argnombres,
           coalesce(p.proargmodes::text[], '{}') as argmodos,
           (select coalesce(array_agg(format_type(t, null) order by o), '{}')
              from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality u(t, o)) as argtipos,
           format_type(p.prorettype, null) as retorno,
           p.proretset as conjunto,
           (select c.relname from pg_class c where c.reltype = p.prorettype) as retorno_tabla
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  ) x`);

function tipoTs(pg) {
  const arreglo = pg.endsWith('[]');
  const base = pg
    .replace(/\[\]$/, '')
    .replace(/\(.*\)/, '')
    .trim();
  const mapa = {
    uuid: 'string',
    text: 'string',
    'character varying': 'string',
    character: 'string',
    citext: 'string',
    date: 'string',
    'timestamp with time zone': 'string',
    'timestamp without time zone': 'string',
    time: 'string',
    interval: 'string',
    smallint: 'number',
    integer: 'number',
    bigint: 'number',
    numeric: 'number',
    real: 'number',
    'double precision': 'number',
    boolean: 'boolean',
    jsonb: 'Json',
    json: 'Json',
    bytea: 'string',
    void: 'undefined',
    inet: 'string',
  };
  const ts = mapa[base] ?? 'unknown';
  return arreglo ? `${ts}[]` : ts;
}

const q = (s) => (/^[a-z_][a-z0-9_]*$/.test(s) ? s : JSON.stringify(s));
const porTabla = new Map();
for (const c of columnas) {
  if (!porTabla.has(c.tabla)) porTabla.set(c.tabla, { tipo: c.tipo, columnas: [] });
  porTabla.get(c.tabla).columnas.push(c);
}

const relacionesDe = (tabla) =>
  relaciones
    .filter((r) => r.tabla === tabla)
    .map(
      (r) =>
        `          {\n            foreignKeyName: ${JSON.stringify(r.nombre)};\n            columns: ${JSON.stringify(r.columnas)};\n            isOneToOne: ${r.uno_a_uno};\n            referencedRelation: ${JSON.stringify(r.referenciada)};\n            referencedColumns: ${JSON.stringify(r.columnas_ref)};\n          },`,
    )
    .join('\n');

function bloqueTabla(nombre, info) {
  const fila = info.columnas.map((c) => `          ${q(c.nombre)}: ${tipoTs(c.pgtipo)}${c.nulable ? ' | null' : ''};`).join('\n');
  const rel = relacionesDe(nombre);
  if (info.tipo === 'v') {
    const filaVista = info.columnas.map((c) => `          ${q(c.nombre)}: ${tipoTs(c.pgtipo)} | null;`).join('\n');
    return `      ${q(nombre)}: {\n        Row: {\n${filaVista}\n        };\n        Relationships: [];\n      };`;
  }
  const insert = info.columnas
    .filter((c) => !c.solo_lectura)
    .map((c) => `          ${q(c.nombre)}${c.nulable || c.con_default ? '?' : ''}: ${tipoTs(c.pgtipo)}${c.nulable ? ' | null' : ''};`)
    .join('\n');
  const update = info.columnas
    .filter((c) => !c.solo_lectura)
    .map((c) => `          ${q(c.nombre)}?: ${tipoTs(c.pgtipo)}${c.nulable ? ' | null' : ''};`)
    .join('\n');
  return `      ${q(nombre)}: {\n        Row: {\n${fila}\n        };\n        Insert: {\n${insert}\n        };\n        Update: {\n${update}\n        };\n        Relationships: [\n${rel}\n        ];\n      };`;
}

function bloqueFuncion(f) {
  const entradas = [];
  const salidas = [];
  f.argnombres.forEach((n, i) => {
    const modo = f.argmodos[i] ?? 'i';
    const tipo = tipoTs(f.argtipos[i] ?? 'unknown');
    if (modo === 'i' || modo === 'b') entradas.push(`          ${q(n)}: ${tipo};`);
    if (modo === 't' || modo === 'o' || modo === 'b') salidas.push(`            ${q(n)}: ${tipo};`);
  });
  let retorno;
  if (salidas.length > 0) retorno = `{\n${salidas.join('\n')}\n          }[]`;
  else if (f.retorno_tabla) retorno = `Database['public']['Tables'][${JSON.stringify(f.retorno_tabla)}]['Row']${f.conjunto ? '[]' : ''}`;
  else retorno = tipoTs(f.retorno) + (f.conjunto ? '[]' : '');
  const args = entradas.length ? `{\n${entradas.join('\n')}\n        }` : 'never';
  return `      ${q(f.nombre)}: {\n        Args: ${args};\n        Returns: ${retorno};\n      };`;
}

const tablas = [...porTabla]
  .filter(([, i]) => i.tipo === 'r')
  .map(([n, i]) => bloqueTabla(n, i))
  .join('\n');
const vistas = [...porTabla]
  .filter(([, i]) => i.tipo === 'v')
  .map(([n, i]) => bloqueTabla(n, i))
  .join('\n');
const fns = funciones.map(bloqueFuncion).join('\n');

const salida = `// GENERADO por scripts/gen-db-types.mjs desde supabase/migrations — no editar a mano.
// Regenerar: pnpm db:types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13';
  };
  public: {
    Tables: {
${tablas}
    };
    Views: {
${vistas}
    };
    Functions: {
${fns}
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type Publico = Database['public'];
export type Tabla<T extends keyof Publico['Tables']> = Publico['Tables'][T]['Row'];
export type TablaInsert<T extends keyof Publico['Tables']> = Publico['Tables'][T]['Insert'];
export type TablaUpdate<T extends keyof Publico['Tables']> = Publico['Tables'][T]['Update'];
export type Vista<T extends keyof Publico['Views']> = Publico['Views'][T]['Row'];
`;

// SOED_TIPOS_SALIDA permite escribir en un directorio del usuario de Postgres y copiar después.
const destino = process.env.SOED_TIPOS_SALIDA ?? new URL('../packages/shared-types/src/database.types.ts', import.meta.url).pathname;
writeFileSync(destino, salida);
console.log(`✓ ${destino}: ${porTabla.size} tablas/vistas, ${funciones.length} funciones`);
