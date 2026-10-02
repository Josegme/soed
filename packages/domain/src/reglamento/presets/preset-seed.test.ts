import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRESET_ENCUENTRO_2026 } from './encuentro-2026';

const SEED = fileURLToPath(new URL('../../../../../clients/_template/seed.sql', import.meta.url));
const PATRON = /(-- <preset:encuentro-2026>\n)([\s\S]*?)(\n\s*-- <\/preset>)/;

const literal = (): string => `  '${JSON.stringify(PRESET_ENCUENTRO_2026).replaceAll("'", "''")}'::jsonb`;

describe('[TR-10] seed del preset sincronizado con el dominio', () => {
  it('clients/_template/seed.sql contiene exactamente PRESET_ENCUENTRO_2026', () => {
    const sql = readFileSync(SEED, 'utf8');
    if (process.env.ACTUALIZAR_SEED === '1') {
      writeFileSync(SEED, sql.replace(PATRON, (_, a: string, _b: string, c: string) => `${a}${literal()}${c}`));
    }
    const actual = readFileSync(SEED, 'utf8').match(PATRON)?.[2];
    expect(actual).toBe(literal());
  });
});
