#!/usr/bin/env node
// Selecciona la instancia de cliente en build (ADR-0003). Lee SOED_CLIENT
// (por defecto "_template"), genera el módulo que importa su client.config.ts,
// enlaza su theme.css y copia sus assets a public/cliente/. Los archivos
// generados no se versionan.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const raiz = join(web, '..', '..');
const slug = process.env.SOED_CLIENT || '_template';
const carpeta = join(raiz, 'clients', slug);

if (!/^[a-z0-9_-]+$/.test(slug) || !existsSync(join(carpeta, 'client.config.ts'))) {
  console.error(`✗ SOED_CLIENT="${slug}" no existe en clients/ (falta client.config.ts)`);
  process.exit(1);
}
for (const archivo of ['theme.css', 'assets']) {
  if (!existsSync(join(carpeta, archivo))) {
    console.error(`✗ clients/${slug}/${archivo} es obligatorio`);
    process.exit(1);
  }
}

const generado = join(web, 'src', 'cliente', 'generado');
mkdirSync(generado, { recursive: true });
const rel = (destino) => relative(generado, destino).split('\\').join('/');
writeFileSync(
  join(generado, 'config.ts'),
  `// GENERADO por scripts/cliente.mjs — no editar. Cliente: ${slug}\nexport { default } from '${rel(join(carpeta, 'client.config'))}';\nexport const SLUG_CLIENTE = '${slug}';\n`,
);
writeFileSync(join(generado, 'theme.css'), `/* GENERADO — cliente ${slug} */\n@import '${rel(join(carpeta, 'theme.css'))}';\n`);

const publico = join(web, 'public', 'cliente');
rmSync(publico, { recursive: true, force: true });
cpSync(join(carpeta, 'assets'), publico, { recursive: true });
console.log(`✓ cliente "${slug}" seleccionado`);
