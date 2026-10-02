#!/usr/bin/env node
// Matriz de trazabilidad: funcionalidad (inventario) → módulo → datos/RLS →
// pantalla → pruebas. Las pruebas se vinculan por etiquetas [ID] en su título
// (Vitest, pgTAP y Playwright). Genera docs/auditoria/MATRIZ_TRAZABILIDAD.md.
// Uso: pnpm trace [--minimo=70]  (falla si la cobertura queda por debajo).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const raiz = new URL('..', import.meta.url).pathname;

function parsearCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo);
      if (fila.some((x) => x !== '')) filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  if (campo || fila.length) filas.push([...fila, campo]);
  return filas;
}

function archivos(dir, filtro) {
  let salida = [];
  for (const nombre of readdirSync(dir)) {
    if (['node_modules', '.next', '.next-e2e', 'dist', 'coverage', '.turbo'].includes(nombre)) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida = salida.concat(archivos(ruta, filtro));
    else if (filtro(ruta)) salida.push(ruta);
  }
  return salida;
}

const NIVELES = [
  { clave: 'dominio', etiqueta: 'Dominio', archivos: archivos(join(raiz, 'packages'), (r) => r.endsWith('.test.ts')) },
  { clave: 'aplicacion', etiqueta: 'Aplicación', archivos: archivos(join(raiz, 'apps/web/src'), (r) => r.endsWith('.test.ts') && !r.endsWith('.integracion.test.ts')) },
  { clave: 'sql', etiqueta: 'RLS/SQL', archivos: archivos(join(raiz, 'supabase/tests/database'), (r) => r.endsWith('.sql')) },
  { clave: 'integracion', etiqueta: 'Integración', archivos: archivos(join(raiz, 'apps/web/src'), (r) => r.endsWith('.integracion.test.ts')) },
  { clave: 'e2e', etiqueta: 'E2E', archivos: archivos(join(raiz, 'apps/web/e2e'), (r) => r.endsWith('.spec.ts')) },
];

const ETIQUETA = /\[((?:SA|OR|PR|JU|OP|PU|TR)-\d{2})\]/g;
const cobertura = new Map();
for (const nivel of NIVELES) {
  for (const archivo of nivel.archivos) {
    const texto = readFileSync(archivo, 'utf8');
    for (const m of texto.matchAll(ETIQUETA)) {
      const id = m[1];
      const porNivel = cobertura.get(id) ?? new Map();
      const lista = porNivel.get(nivel.clave) ?? new Set();
      lista.add(relative(raiz, archivo));
      porNivel.set(nivel.clave, lista);
      cobertura.set(id, porNivel);
    }
  }
}

const [encabezado, ...filas] = parsearCsv(readFileSync(join(raiz, 'docs/auditoria/inventario.csv'), 'utf8'));
const col = Object.fromEntries(encabezado.map((n, i) => [n, i]));
const items = filas.map((f) => ({
  id: f[col.id],
  area: f[col.area],
  etapa: f[col.etapa],
  funcionalidad: f[col.funcionalidad],
  confianza: f[col.confianza],
  modulo: f[col.modulo],
  datos: f[col.datos_rls],
  pantalla: f[col.pantalla],
}));

const escapar = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const porArea = new Map();
for (const it of items) porArea.set(it.area, [...(porArea.get(it.area) ?? []), it]);

const cubiertas = items.filter((it) => cobertura.has(it.id));
const pct = (a, b) => (b === 0 ? 0 : Math.round((a / b) * 100));
const sinInventario = [...cobertura.keys()].filter((id) => !items.some((it) => it.id === id)).sort();

let md = `# Matriz de trazabilidad\n\n`;
md += `> Generada por \`pnpm trace\` (scripts/trazabilidad.mjs) a partir de \`docs/auditoria/inventario.csv\` y de las etiquetas \`[ID]\` en las pruebas. No editar a mano.\n\n`;
md += `**Cobertura por pruebas:** ${cubiertas.length} de ${items.length} funcionalidades (${pct(cubiertas.length, items.length)} %).\n\n`;
md += `| Área | Funcionalidades | Con pruebas | % | Dominio | Aplicación | RLS/SQL | Integración | E2E |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for (const [area, lista] of porArea) {
  const con = lista.filter((it) => cobertura.has(it.id));
  const nivel = (clave) => lista.filter((it) => cobertura.get(it.id)?.has(clave)).length;
  md += `| ${area} | ${lista.length} | ${con.length} | ${pct(con.length, lista.length)} | ${nivel('dominio')} | ${nivel('aplicacion')} | ${nivel('sql')} | ${nivel('integracion')} | ${nivel('e2e')} |\n`;
}
md += `\nLeyenda de niveles: D = dominio, A = aplicación (casos de uso), S = RLS/SQL (pgTAP), I = integración (PostgREST real), E = e2e (Playwright + axe).\n`;

for (const [area, lista] of porArea) {
  md += `\n## ${area}\n\n| ID | Funcionalidad | Módulo | Datos / RLS | Pantalla | Pruebas |\n|---|---|---|---|---|---|\n`;
  for (const it of lista) {
    const c = cobertura.get(it.id);
    const niveles = c ? NIVELES.filter((n) => c.has(n.clave)).map((n) => n.etiqueta[0]).join(' · ') : '—';
    md += `| ${it.id} | ${escapar(it.funcionalidad)}${it.confianza !== 'EXPLICITA' ? ` _(${it.confianza.toLowerCase()})_` : ''} | ${escapar(it.modulo)} | ${escapar(it.datos)} | ${escapar(it.pantalla)} | ${niveles} |\n`;
  }
}

md += `\n## Funcionalidades sin prueba vinculada\n\n`;
md += items
  .filter((it) => !cobertura.has(it.id))
  .map((it) => `- **${it.id}** (${it.area}, etapa ${it.etapa}): ${it.funcionalidad}`)
  .join('\n');
if (sinInventario.length) md += `\n\n## Etiquetas en pruebas sin funcionalidad en el inventario\n\n${sinInventario.map((id) => `- ${id}`).join('\n')}\n`;
md += '\n';

writeFileSync(join(raiz, 'docs/auditoria/MATRIZ_TRAZABILIDAD.md'), md);
console.log(`✓ ${cubiertas.length}/${items.length} funcionalidades con pruebas (${pct(cubiertas.length, items.length)} %) → docs/auditoria/MATRIZ_TRAZABILIDAD.md`);
const minimo = Number(process.argv.find((a) => a.startsWith('--minimo='))?.split('=')[1] ?? 0);
if (pct(cubiertas.length, items.length) < minimo) {
  console.error(`✗ cobertura por debajo del mínimo (${minimo} %)`);
  process.exit(1);
}
