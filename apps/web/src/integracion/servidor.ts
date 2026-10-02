import { createServer, request, type Server } from 'node:http';
import { verificarJwt } from './jwt';

/**
 * globalSetup de Vitest: proxy mínimo con la forma de la API de Supabase
 * (/rest/v1 → PostgREST, /auth/v1/user desde el JWT) para que supabase-js y
 * los adaptadores de la app corran sin cambios contra el esquema real.
 */
let servidor: Server | undefined;

export async function setup() {
  const destino = new URL(process.env.PGRST_URL ?? 'http://127.0.0.1:54330');
  const secreto = process.env.JWT_SECRET ?? '';
  servidor = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url.startsWith('/auth/v1/user')) {
      const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
      const claims = verificarJwt(token, secreto);
      res.writeHead(claims?.sub ? 200 : 401, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify(
          claims?.sub ? { id: claims.sub, email: claims.email ?? null, aud: 'authenticated', role: claims.role } : { message: 'invalid' },
        ),
      );
      return;
    }
    if (!url.startsWith('/rest/v1')) {
      res.writeHead(404).end();
      return;
    }
    const proxy = request(
      {
        hostname: destino.hostname,
        port: destino.port,
        path: url.replace('/rest/v1', '') || '/',
        method: req.method,
        headers: { ...req.headers, host: destino.host },
      },
      (respuesta) => {
        res.writeHead(respuesta.statusCode ?? 502, respuesta.headers);
        respuesta.pipe(res);
      },
    );
    proxy.on('error', () => res.writeHead(502).end());
    req.pipe(proxy);
  });
  await new Promise<void>((ok) => servidor!.listen(54331, '127.0.0.1', ok));
}

export async function teardown() {
  await new Promise<void>((ok) => (servidor ? servidor.close(() => ok()) : ok()));
}
