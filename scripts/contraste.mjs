#!/usr/bin/env node
// Verifica contraste WCAG 2.2 AA (4.5:1 texto normal) de los tokens de cada
// clients/<slug>/theme.css. Falla el CI si algún par obligatorio no cumple.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PARES = [
  ['texto', 'fondo'], ['texto', 'superficie'], ['texto', 'superficie-2'],
  ['texto-suave', 'fondo'], ['texto-suave', 'superficie'], ['texto-suave', 'superficie-2'],
  ['marca-contraste', 'marca'], ['acento-contraste', 'acento'], ['marca', 'fondo'], ['marca', 'superficie'],
  ['exito', 'superficie'], ['alerta', 'superficie'], ['error', 'superficie'], ['info', 'superficie'],
];
const MINIMO = 4.5;

const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminancia = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

let fallas = 0;
const raiz = new URL('../clients', import.meta.url).pathname;
for (const cliente of readdirSync(raiz)) {
  const ruta = join(raiz, cliente, 'theme.css');
  if (!existsSync(ruta)) continue;
  const css = readFileSync(ruta, 'utf8');
  const tokens = Object.fromEntries([...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
  for (const [a, b] of PARES) {
    if (!tokens[a] || !tokens[b]) {
      console.error(`✗ ${cliente}: falta el token --${!tokens[a] ? a : b}`);
      fallas++;
      continue;
    }
    const r = contraste(tokens[a], tokens[b]);
    const ok = r >= MINIMO;
    if (!ok) fallas++;
    console.log(`${ok ? '✓' : '✗'} ${cliente}: ${a} / ${b} = ${r.toFixed(2)}:1`);
  }
}
if (fallas > 0) {
  console.error(`\n${fallas} par(es) no cumplen WCAG AA`);
  process.exit(1);
}
