// Doble de la API de Supabase para pruebas locales (integración y e2e del panel):
// /rest/v1 → PostgREST real y /auth/v1/user desde el JWT HS256 de la sesión.
// /storage/v1/object/sign → URLs firmadas con contenido sintético por ruta
// (las políticas de storage se prueban con pgTAP, no aquí).
// No implementa login: las pruebas firman el JWT del usuario del fixture.
import { createHmac } from 'node:crypto';
import { createServer, request } from 'node:http';

export function verificarJwt(token, secreto) {
  const [cabecera, cuerpo, firma] = String(token).split('.');
  if (!cabecera || !cuerpo || !firma) return null;
  const esperada = createHmac('sha256', secreto).update(`${cabecera}.${cuerpo}`).digest('base64url');
  return esperada === firma ? JSON.parse(Buffer.from(cuerpo, 'base64url').toString()) : null;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};
const firmar = (ruta, secreto) => createHmac('sha256', secreto).update(`storage:${ruta}`).digest('base64url');

/** Contenido determinístico por ruta: permite verificar el archivo bajado sin subir audios reales. */
export const contenidoSintetico = (ruta) => Buffer.from(`soed-musica:${ruta}\n`.repeat(64));

function atenderStorage(req, res, url, secreto) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS).end();
    return;
  }
  const { pathname, searchParams } = new URL(url, 'http://local');
  const resto = decodeURIComponent(pathname.replace('/storage/v1/object/sign/', ''));
  if (req.method === 'GET') {
    const ok = searchParams.get('token') === firmar(resto, secreto);
    res.writeHead(ok ? 200 : 400, { ...CORS, 'content-type': ok ? 'audio/mpeg' : 'application/json' });
    res.end(ok ? contenidoSintetico(resto) : JSON.stringify({ error: 'InvalidSignature' }));
    return;
  }
  const claims = verificarJwt((req.headers.authorization ?? '').replace(/^Bearer /, ''), secreto);
  let cuerpo = '';
  req.on('data', (d) => (cuerpo += d));
  req.on('end', () => {
    if (!claims?.role) {
      res.writeHead(401, { ...CORS, 'content-type': 'application/json' }).end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    const { paths = [] } = JSON.parse(cuerpo || '{}');
    const bucket = resto.replace(/\/$/, '');
    res.writeHead(200, { ...CORS, 'content-type': 'application/json' });
    res.end(
      JSON.stringify(
        paths.map((ruta) => ({
          path: ruta,
          error: null,
          signedURL: `/object/sign/${bucket}/${ruta}?token=${firmar(`${bucket}/${ruta}`, secreto)}`,
        })),
      ),
    );
  });
}

/** @param {{ puerto: number, destino: string, secreto: string }} opciones */
export function iniciarSupabaseFalso({ puerto, destino, secreto }) {
  const pgrst = new URL(destino);
  const servidor = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url.startsWith('/auth/v1/user')) {
      const claims = verificarJwt((req.headers.authorization ?? '').replace(/^Bearer /, ''), secreto);
      res.writeHead(claims?.sub ? 200 : 401, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify(
          claims?.sub ? { id: claims.sub, email: claims.email ?? null, aud: 'authenticated', role: claims.role } : { message: 'invalid' },
        ),
      );
      return;
    }
    if (url.startsWith('/auth/v1/logout')) {
      res.writeHead(204).end();
      return;
    }
    if (url.startsWith('/storage/v1/object/sign/')) {
      atenderStorage(req, res, url, secreto);
      return;
    }
    if (!url.startsWith('/rest/v1')) {
      res.writeHead(404).end();
      return;
    }
    const proxy = request(
      {
        hostname: pgrst.hostname,
        port: pgrst.port,
        path: url.replace('/rest/v1', '') || '/',
        method: req.method,
        headers: { ...req.headers, host: pgrst.host },
      },
      (respuesta) => {
        res.writeHead(respuesta.statusCode ?? 502, respuesta.headers);
        respuesta.pipe(res);
      },
    );
    proxy.on('error', () => res.writeHead(502).end());
    req.pipe(proxy);
  });
  return new Promise((ok) => servidor.listen(puerto, '127.0.0.1', () => ok(servidor)));
}

// Uso directo: node scripts/lib/supabase-falso.mjs (lee PGRST_URL, JWT_SECRET y PUERTO_SUPABASE).
if (import.meta.url === `file://${process.argv[1]}`) {
  await iniciarSupabaseFalso({
    puerto: Number(process.env.PUERTO_SUPABASE ?? 54331),
    destino: process.env.PGRST_URL ?? 'http://127.0.0.1:54330',
    secreto: process.env.JWT_SECRET ?? '',
  });
  console.log(`supabase falso en :${process.env.PUERTO_SUPABASE ?? 54331}`);
}
