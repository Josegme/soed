import { definirCliente } from '@soed/shared-types';

/**
 * Plantilla de instancia. Copiar a clients/<slug>/ y completar (playbook en
 * docs/runbooks/ALTA_CLIENTE.md). Se valida con Zod en build: si falta algo,
 * el deploy falla. Cada clave nueva requiere un ADR (ADR-0003).
 */
export default definirCliente({
  slug: 'template',
  nombre: 'SOED Demo',
  nombreCorto: 'SOED',
  descripcion: {
    es: 'Plataforma para eventos competitivos de danza.',
    'pt-BR': 'Plataforma para eventos competitivos de dança.',
  },
  dominio: 'demo.soed.app',
  idiomas: ['es', 'pt-BR'],
  idiomaDefecto: 'es',
  zonaHorariaDefecto: 'America/Argentina/Buenos_Aires',
  modulos: {
    inscripciones: true,
    liquidaciones: true,
    ordenEnVivo: true,
    puntajes: true,
    acreditacion: true,
    clases: false,
    entradas: false,
    hoteles: false,
    comunicados: true,
    pwa: true,
  },
  email: { remitente: 'no-responder@demo.soed.app', nombreRemitente: 'SOED Demo' },
  reglamentoPreset: 'encuentro-2026',
  marca: {
    logo: '/cliente/logo.svg',
    logoAlt: 'SOED',
    favicon: '/cliente/favicon.svg',
    colorTema: '#1F2A44',
  },
  legal: {
    razonSocial: 'PENDIENTE: razón social del cliente',
    contactoEmail: 'legal@demo.soed.app',
    terminos: {},
    privacidad: {},
  },
  redes: {},
});
