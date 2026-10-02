/**
 * ZIP sin compresión (método STORE) escrito a mano para no sumar una
 * dependencia (OR-49, OP-14): la música ya viene comprimida (mp3, m4a), así
 * que comprimir de nuevo no ahorra espacio y solo consume CPU del dispositivo.
 * Funciona igual en el navegador y en Node. Sin ZIP64: hasta 4 GiB y 65 535 archivos.
 */

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ArchivoZip {
  nombre: string;
  datos: Uint8Array;
}

const MAXIMO = 0xffffffff;

function fechaDos(fecha: Date): { hora: number; dia: number } {
  const anio = Math.max(1980, fecha.getFullYear());
  return {
    hora: (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | Math.floor(fecha.getSeconds() / 2),
    dia: ((anio - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate(),
  };
}

/**
 * Partes del ZIP en orden (encabezados y datos sin copiar), listas para
 * `new Blob(partes)`: evita duplicar en memoria varios cientos de MB.
 */
export function partesZip(archivos: readonly ArchivoZip[], fecha = new Date()): Uint8Array[] {
  if (archivos.length > 0xffff) throw new Error('ZIP_DEMASIADOS_ARCHIVOS');
  const codificador = new TextEncoder();
  const { hora, dia } = fechaDos(fecha);
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const archivo of archivos) {
    const nombre = codificador.encode(archivo.nombre);
    const tamano = archivo.datos.length;
    const crc = crc32(archivo.datos);
    if (tamano > MAXIMO || desplazamiento > MAXIMO) throw new Error('ZIP_DEMASIADO_GRANDE');

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // versión necesaria
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true); // STORE
    local.setUint16(10, hora, true);
    local.setUint16(12, dia, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, tamano, true);
    local.setUint32(22, tamano, true);
    local.setUint16(26, nombre.length, true);
    local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nombre, archivo.datos);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true); // versión que lo creó
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, hora, true);
    cd.setUint16(14, dia, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, tamano, true);
    cd.setUint32(24, tamano, true);
    cd.setUint16(28, nombre.length, true);
    // extra, comentario, disco, atributos internos y externos en 0
    cd.setUint32(42, desplazamiento, true);
    central.push(new Uint8Array(cd.buffer), nombre);

    desplazamiento += 30 + nombre.length + tamano;
  }

  const tamanoCentral = central.reduce((n, p) => n + p.length, 0);
  if (desplazamiento + tamanoCentral > MAXIMO) throw new Error('ZIP_DEMASIADO_GRANDE');
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamanoCentral, true);
  fin.setUint32(16, desplazamiento, true);
  return [...partes, ...central, new Uint8Array(fin.buffer)];
}

/** Nombre de archivo seguro en Windows, macOS y Linux, conservando acentos. */
export function nombreArchivoSeguro(nombre: string, maximo = 120): string {
  const limpio = nombre
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return (limpio || 'archivo').slice(0, maximo);
}
