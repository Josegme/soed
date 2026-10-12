// Genera architecture/DATABASE_SCHEMA.md desde supabase/migrations: tablas con
// columnas, políticas RLS, funciones públicas (RPC) y helpers privados.
// Uso: node scripts/esquema-doc.mjs   (CI puede comparar con git diff --exit-code)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = new URL('..', import.meta.url).pathname;
const dir = join(raiz, 'supabase/migrations');
const migraciones = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const tablas = new Map();
const politicas = new Map();
const rpc = [];
const privadas = [];

for (const archivo of migraciones) {
  const sql = readFileSync(join(dir, archivo), 'utf8').replace(/--[^\n]*/g, '');
  for (const m of sql.matchAll(/create table (public|private)\.(\w+) \(([\s\S]*?)\n\);/g)) {
    const columnas = m[3]
      .split('\n')
      .map((l) => l.trim().replace(/,$/, ''))
      .filter((l) => /^[a-z_]+ /.test(l) && !/^(unique|primary|foreign|check|constraint|exclude)\b/.test(l))
      .map((l) => {
        const [nombre, ...resto] = l.split(/\s+/);
        const tipo = resto
          .join(' ')
          .replace(/\s+check \(.*$/, '')
          .replace(/\s+references .*$/, (r) => ` → ${r.match(/references ([\w.]+)/)?.[1] ?? ''}`);
        return { nombre, tipo };
      });
    tablas.set(`${m[1]}.${m[2]}`, { archivo, columnas });
  }
  for (const m of sql.matchAll(/create policy (\w+) on (public|storage)\.(\w+) for (\w+) to (\w+)/g)) {
    const clave = `${m[2]}.${m[3]}`;
    politicas.set(clave, [...(politicas.get(clave) ?? []), `${m[1]} (${m[4]}, ${m[5]})`]);
  }
  for (const m of sql.matchAll(/create or replace function (public|private)\.(\w+)\(([^)]*)\)/g)) {
    (m[1] === 'public' ? rpc : privadas).push({ nombre: m[2], args: m[3].replace(/\s+/g, ' ').trim(), archivo });
  }
}

let md = `# Esquema de datos de SOED

> Generado por \`node scripts/esquema-doc.mjs\` desde \`supabase/migrations/\`. No editar a mano: cambiar la migración y regenerar.

Principios (ADR-0004, ADR-0007, CLAUDE.md): RLS en todas las tablas en la misma migración; aislamiento por \`evento_id\`; permisos por evento con \`private.eventos_con_permiso()\`; índice en toda clave foránea (verificado por pgTAP); montos en centavos; contenido del organizador en \`jsonb\` traducible; público solo por RPC \`security definer\` sin datos personales.

## Migraciones

${migraciones.map((m) => `- \`${m}\``).join('\n')}

## Tablas (${tablas.size})

`;
for (const [nombre, t] of [...tablas].sort()) {
  md += `### \`${nombre}\`\n\n_${t.archivo}_\n\n| Columna | Tipo |\n| --- | --- |\n`;
  for (const c of t.columnas) md += `| \`${c.nombre}\` | ${c.tipo.replace(/\|/g, '\\|')} |\n`;
  const pols = politicas.get(nombre);
  md += `\n${pols ? `**RLS:** ${pols.join(' · ')}` : nombre.startsWith('private.') ? '**RLS:** habilitada sin políticas (solo funciones del esquema private).' : '**RLS:** habilitada; acceso por funciones o vistas.'}\n\n`;
}
md += `## Funciones públicas (RPC)\n\n| Función | Argumentos | Migración |\n| --- | --- | --- |\n`;
for (const f of rpc) md += `| \`${f.nombre}\` | \`${f.args || '—'}\` | ${f.archivo} |\n`;
md += `\n## Funciones auxiliares (\`private\`)\n\n| Función | Argumentos |\n| --- | --- |\n`;
for (const f of privadas) md += `| \`${f.nombre}\` | \`${f.args || '—'}\` |\n`;
md += `\n## Políticas de Storage\n\n${(politicas.get('storage.objects') ?? []).map((p) => `- ${p}`).join('\n')}\n`;

writeFileSync(join(raiz, 'architecture/DATABASE_SCHEMA.md'), md);
console.log(`✓ ${tablas.size} tablas, ${rpc.length} RPC, ${privadas.length} funciones privadas → architecture/DATABASE_SCHEMA.md`);
