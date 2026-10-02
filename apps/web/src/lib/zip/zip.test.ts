import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { crc32, nombreArchivoSeguro, partesZip } from './zip';

const unir = (partes: Uint8Array[]) => Buffer.concat(partes.map((p) => Buffer.from(p.buffer, p.byteOffset, p.byteLength)));
const hayUnzip = (() => {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('[OR-49] [OP-14] ZIP de música sin dependencias', () => {
  it('calcula el CRC-32 estándar', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('arma un ZIP con la firma de fin de directorio y una entrada por archivo', () => {
    const zip = unir(partesZip([{ nombre: 'a.txt', datos: new TextEncoder().encode('hola') }], new Date(2027, 4, 1, 10, 30, 0)));
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 12)).toBe(1);
  });

  it.runIf(hayUnzip)('lo valida unzip, con nombres UTF-8 en orden de salida', () => {
    const dir = mkdtempSync(join(tmpdir(), 'soed-zip-'));
    const archivos = [
      { nombre: '001 - Solo de Ana - Academia Uno.mp3', datos: new Uint8Array(5000).map((_, i) => i % 251) },
      { nombre: '002 - Dúo São João.mp3', datos: new TextEncoder().encode('música') },
    ];
    const ruta = join(dir, 'bloque.zip');
    writeFileSync(ruta, unir(partesZip(archivos)));
    expect(execFileSync('unzip', ['-tq', ruta], { encoding: 'utf8' })).toContain('No errors');
    execFileSync('unzip', ['-q', ruta, '-d', join(dir, 'x')]);
    expect(readFileSync(join(dir, 'x', '002 - Dúo São João.mp3'), 'utf8')).toBe('música');
    expect(readFileSync(join(dir, 'x', '001 - Solo de Ana - Academia Uno.mp3')).equals(Buffer.from(archivos[0]!.datos))).toBe(true);
  });

  it('limpia caracteres no válidos en nombres de archivo', () => {
    expect(nombreArchivoSeguro('Solo: "A/B" <1>?')).toBe('Solo A B 1');
    expect(nombreArchivoSeguro('Coreografía final. ')).toBe('Coreografía final');
    expect(nombreArchivoSeguro('***')).toBe('archivo');
  });
});
