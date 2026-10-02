#!/usr/bin/env node
// CI de traducciones (ADR-0005): falla si una clave existe en un idioma y no en
// otro, si hay valores vacíos o si los parámetros ICU ({nombre}) no coinciden.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const carpeta = new URL('../apps/web/messages', import.meta.url).pathname;
const archivos = readdirSync(carpeta).filter((f) => f.endsWith('.json'));
const catalogos = Object.fromEntries(archivos.map((f) => [f.replace('.json', ''), JSON.parse(readFileSync(join(carpeta, f), 'utf8'))]));

const aplanar = (obj, prefijo = '') =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? aplanar(v, `${prefijo}${k}.`) : [[`${prefijo}${k}`, v]]));
const parametros = (texto) =>
  [...String(texto).matchAll(/\{\s*(\w+)\s*[,}]/g)]
    .map((m) => m[1])
    .sort()
    .join(',');

const planos = Object.fromEntries(Object.entries(catalogos).map(([loc, c]) => [loc, Object.fromEntries(aplanar(c))]));
const todas = new Set(Object.values(planos).flatMap((p) => Object.keys(p)));
const errores = [];
for (const clave of todas) {
  const params = new Set();
  for (const [loc, plano] of Object.entries(planos)) {
    if (!(clave in plano)) errores.push(`falta "${clave}" en ${loc}`);
    else if (typeof plano[clave] !== 'string' || plano[clave].trim() === '') errores.push(`"${clave}" vacío en ${loc}`);
    else params.add(parametros(plano[clave]));
  }
  if (params.size > 1) errores.push(`"${clave}": parámetros distintos entre idiomas (${[...params].join(' | ')})`);
}
if (errores.length) {
  console.error(errores.map((e) => `✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✓ ${todas.size} claves en ${Object.keys(planos).join(', ')}`);
