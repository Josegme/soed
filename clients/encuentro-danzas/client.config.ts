import { definirCliente } from '@soed/shared-types';

/**
 * Encuentro de Danzas — primer cliente. Datos de marca y legales PENDIENTES de
 * recibir del organizador (logos oficiales, razón social, textos legales y
 * dominio de producción). Ver docs/auditoria, pendientes P-01 a P-06.
 */
export default definirCliente({
  slug: 'encuentro-danzas',
  nombre: 'Encuentro de Danzas',
  nombreCorto: 'Encuentro',
  descripcion: {
    es: 'Selectivos regionales y final: Intercâmbio Cultural de Dança.',
    'pt-BR': 'Seletivas regionais e final: Intercâmbio Cultural de Dança.',
  },
  dominio: 'app.encuentrodanzas.com',
  idiomas: ['es', 'pt-BR'],
  idiomaDefecto: 'es',
  zonaHorariaDefecto: 'America/Sao_Paulo',
  modulos: {
    inscripciones: true,
    liquidaciones: true,
    ordenEnVivo: true,
    puntajes: true,
    acreditacion: true,
    clases: true,
    entradas: true,
    hoteles: true,
    comunicados: true,
    pwa: true,
  },
  email: { remitente: 'inscripciones@encuentrodanzas.com', nombreRemitente: 'Encuentro de Danzas' },
  reglamentoPreset: 'encuentro-2026',
  marca: {
    logo: '/cliente/logo.svg',
    logoAlt: 'Encuentro de Danzas',
    favicon: '/cliente/favicon.svg',
    colorTema: '#0b3a46',
  },
  legal: {
    razonSocial: 'PENDIENTE: razón social del organizador',
    contactoEmail: 'inscripciones@encuentrodanzas.com',
    terminos: {},
    privacidad: {},
  },
  redes: {},
});
