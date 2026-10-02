import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { enviarPendientes, type MensajeSaliente, type ProveedorEmail } from '@/modules/notificaciones/infrastructure/enviar';
import { notificarAcademia } from '@/modules/notificaciones/infrastructure/encolar';
import { ids, sql } from './utilidades';

/* Emails transaccionales: encolado por destinatario e idioma y envío idempotente (ADR-0013). */

const marca = { nombre: 'Encuentro', colorMarca: '#0b3a46', colorAcento: '#f2b53a', urlSitio: 'https://ejemplo.test', pie: 'Encuentro' };
const entorno = { EMAIL_MODO: process.env.EMAIL_MODO, VERCEL_ENV: process.env.VERCEL_ENV };

beforeAll(() => {
  // Producción simulada: las filas quedan PENDIENTE y el proveedor (falso) se invoca.
  process.env.EMAIL_MODO = 'resend';
  process.env.VERCEL_ENV = 'production';
  sql(`update public.perfil set idioma = 'pt-BR' where id = '${ids.prof2}'`);
  sql(`update public.email_envio set estado = 'SIMULADO' where estado = 'PENDIENTE'`);
});
afterAll(() => Object.assign(process.env, entorno));

function proveedor(fallar = false) {
  const enviados: MensajeSaliente[] = [];
  const p: ProveedorEmail = {
    async enviar(m) {
      if (fallar) throw new Error(`rechazado para ${m.para}`);
      enviados.push(m);
      return { id: `re_${enviados.length}` };
    },
  };
  return { p, enviados };
}

describe('[PR-22] [TR-22] [TR-44] emails transaccionales', () => {
  it('encola un email por profesor en su idioma con el monto formateado', async () => {
    await notificarAcademia({
      eventoId: ids.evento_a!,
      academiaId: ids.academia2!,
      tipo: 'cobro_registrado',
      datos: {
        evento: { es: 'Selectivo A', 'pt-BR': 'Seletiva A' },
        numero: 'LIQ-SELA-0002',
        monto: () => 'R$ 40,00',
        saldo: () => 'R$ 0,00',
      },
      ruta: '/academia',
    });
    const fila = sql(
      `select idioma || '|' || estado || '|' || (payload ->> 'asunto') || '|' || (payload -> 'accion' ->> 'url') from public.email_envio where usuario_id = '${ids.prof2}' and plantilla = 'cobro_registrado'`,
    );
    expect(fila).toBe('pt-BR|PENDIENTE|Registramos seu pagamento · LIQ-SELA-0002|http://localhost:3000/pt/academia');
  });

  it('envía con el proveedor, usa el id como clave de idempotencia y marca ENVIADO', async () => {
    const { p, enviados } = proveedor();
    const r = await enviarPendientes(supabaseAdmin(), p, { modo: 'resend', marca, remitente: 'Encuentro <inscripciones@ejemplo.test>' });
    expect(r.enviados).toBeGreaterThanOrEqual(1);
    const mensaje = enviados.find((m) => m.para === 'prof2@test.soed')!;
    expect(mensaje.asunto).toBe('Registramos seu pagamento · LIQ-SELA-0002');
    expect(mensaje.html).toContain('Saldo atual: R$ 0,00');
    expect(mensaje.texto).toContain('Ver extrato');
    expect(sql(`select estado || '|' || proveedor_id from public.email_envio where id = '${mensaje.idempotencia}'`)).toMatch(
      /^ENVIADO\|re_\d+$/,
    );
  });

  it('reintenta ante fallas, no guarda direcciones en el error y abandona a los 5 intentos', async () => {
    await notificarAcademia({
      eventoId: ids.evento_a!,
      academiaId: ids.academia1!,
      tipo: 'orden_publicado',
      datos: { evento: { es: 'Selectivo A' } },
      ruta: '/',
    });
    const { p } = proveedor(true);
    for (let i = 0; i < 5; i++) await enviarPendientes(supabaseAdmin(), p, { modo: 'resend', marca, remitente: 'x <x@ejemplo.test>' });
    expect(
      sql(
        `select estado || '|' || intentos || '|' || error from public.email_envio where usuario_id = '${ids.prof1}' and plantilla = 'orden_publicado'`,
      ),
    ).toBe('FALLIDO|5|rechazado para [email]');
  });

  it('[ADR-0013] en modo sink nunca llama al proveedor', async () => {
    await notificarAcademia({
      eventoId: ids.evento_a!,
      academiaId: ids.academia1!,
      tipo: 'resultados_publicados',
      datos: { evento: { es: 'A' } },
      ruta: '/',
    });
    const { p, enviados } = proveedor();
    const r = await enviarPendientes(supabaseAdmin(), p, { modo: 'sink', marca, remitente: 'x <x@ejemplo.test>' });
    expect(r.simulados).toBeGreaterThanOrEqual(1);
    expect(enviados).toEqual([]);
  });
});
