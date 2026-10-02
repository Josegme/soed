import { describe, expect, it } from 'vitest';
import { enviarComunicado, type EmailPreparado, type PuertosComunicados } from './comunicados';

function fake(permiso = true) {
  const encolados: EmailPreparado[] = [];
  const p: PuertosComunicados = {
    puedeEnviar: () => permiso,
    idiomaDefecto: async () => 'es',
    destinatarios: async () => [
      { usuarioId: 'u1', email: 'ana@x.com', idioma: 'pt-BR' },
      { usuarioId: 'u1', email: 'ANA@x.com', idioma: 'pt-BR' },
      { usuarioId: 'u2', email: 'luis@x.com', idioma: 'es' },
    ],
    guardarComunicado: async () => 'c1',
    encolar: async (_e, _c, emails) => void encolados.push(...emails),
  };
  return { p, encolados };
}

describe('[OR-47] [TR-22] comunicados por idioma', () => {
  it('envía uno por email en el idioma de cada destinatario, con fallback', async () => {
    const { p, encolados } = fake();
    const r = await enviarComunicado(p, {
      eventoId: 'e1',
      asunto: { es: 'Cronograma', 'pt-BR': 'Cronograma' },
      cuerpo: { es: 'Hola' },
      audiencia: ['ACADEMIAS'],
    });
    expect(r).toEqual({ ok: true, value: { comunicadoId: 'c1', enviados: 2, porIdioma: { 'pt-BR': 1, es: 1 } } });
    expect(encolados.find((e) => e.idioma === 'pt-BR')?.cuerpo).toBe('Hola');
  });
  it('requiere permiso', async () => {
    expect(await enviarComunicado(fake(false).p, { eventoId: 'e1', asunto: {}, cuerpo: {}, audiencia: ['STAFF'] })).toMatchObject({
      ok: false,
      error: { codigo: 'SIN_PERMISO' },
    });
  });
});
