import { VERSION_ESQUEMA_REGLAMENTO, type ReglamentoEvento } from '../tipos';

/**
 * Preset "encuentro-2026": reglamento por defecto tomado de PLAN_DESARROLLO §3
 * y de las reglas de dominio confirmadas en el pedido del 2026-10-02.
 *
 * Confirmados: tolerancia de grupo 30 %, tolerancia de tiempo 30 s (grupos) y
 * 15 s (solo, dúo, trío), bandas 9,0 / 8,0 / 7,0, edad a la fecha del evento,
 * Composições Coreográficas solo 40+, Reggaeton desde Infantil, Quadro de hasta
 * 10 minutos.
 *
 * Los valores listados en `supuestos` NO constan en el material recibido y deben
 * validarse contra las Bases y Condiciones 2026 (Art. 5 a 7, 14, 15 y 33) antes
 * del primer evento real. Ver docs/auditoria (pendiente P-03).
 */
export const PRESET_ENCUENTRO_2026: ReglamentoEvento = {
  versionEsquema: VERSION_ESQUEMA_REGLAMENTO,
  preset: 'encuentro-2026',
  fechaReferenciaEdad: { tipo: 'INICIO_EVENTO' },
  categorias: [
    { codigo: 'PRE_INFANTIL', nombre: { es: 'Pre-infantil', 'pt-BR': 'Pré-infantil' }, edadMin: 3, edadMax: 6, orden: 1 },
    { codigo: 'INFANTIL', nombre: { es: 'Infantil', 'pt-BR': 'Infantil' }, edadMin: 7, edadMax: 10, orden: 2 },
    { codigo: 'INFANTO_JUVENIL', nombre: { es: 'Infanto-juvenil', 'pt-BR': 'Infantojuvenil' }, edadMin: 11, edadMax: 14, orden: 3 },
    { codigo: 'JUVENIL', nombre: { es: 'Juvenil', 'pt-BR': 'Juvenil' }, edadMin: 15, edadMax: 17, orden: 4 },
    { codigo: 'ADULTO', nombre: { es: 'Adulto', 'pt-BR': 'Adulto' }, edadMin: 18, edadMax: 39, orden: 5 },
    { codigo: 'ADULTO_40', nombre: { es: '40+', 'pt-BR': '40+' }, edadMin: 40, edadMax: null, orden: 6 },
  ],
  formaciones: [
    {
      codigo: 'SOLO',
      nombre: { es: 'Solista', 'pt-BR': 'Solo' },
      integrantesMin: 1,
      integrantesMax: 1,
      toleranciaTiempoSeg: 15,
      criterioCategoria: 'MAYOR',
    },
    {
      codigo: 'DUO',
      nombre: { es: 'Dúo', 'pt-BR': 'Duo' },
      integrantesMin: 2,
      integrantesMax: 2,
      toleranciaTiempoSeg: 15,
      criterioCategoria: 'MAYOR',
    },
    {
      codigo: 'TRIO',
      nombre: { es: 'Trío', 'pt-BR': 'Trio' },
      integrantesMin: 3,
      integrantesMax: 3,
      toleranciaTiempoSeg: 15,
      criterioCategoria: 'MAYOR',
    },
    {
      codigo: 'GRUPO',
      nombre: { es: 'Grupo', 'pt-BR': 'Grupo' },
      integrantesMin: 4,
      integrantesMax: null,
      toleranciaTiempoSeg: 30,
      criterioCategoria: 'TOLERANCIA_GRUPO',
    },
    {
      codigo: 'QUADRO',
      nombre: { es: 'Quadro', 'pt-BR': 'Quadro' },
      integrantesMin: 4,
      integrantesMax: null,
      toleranciaTiempoSeg: 30,
      criterioCategoria: 'TOLERANCIA_GRUPO',
    },
  ],
  generos: [
    { codigo: 'BALLET_CLASICO', nombre: { es: 'Ballet clásico', 'pt-BR': 'Balé clássico' } },
    { codigo: 'JAZZ', nombre: { es: 'Jazz', 'pt-BR': 'Jazz' } },
    { codigo: 'CONTEMPORANEO', nombre: { es: 'Danza contemporánea', 'pt-BR': 'Dança contemporânea' } },
    { codigo: 'DANZAS_URBANAS', nombre: { es: 'Danzas urbanas', 'pt-BR': 'Danças urbanas' } },
    { codigo: 'ESTILO_LIBRE', nombre: { es: 'Estilo libre', 'pt-BR': 'Estilo livre' } },
    { codigo: 'FOLCLORE', nombre: { es: 'Danzas folclóricas', 'pt-BR': 'Danças folclóricas' } },
    { codigo: 'REGGAETON', nombre: { es: 'Reggaeton', 'pt-BR': 'Reggaeton' }, desdeCategoria: 'INFANTIL' },
    {
      codigo: 'COMPOSICIONES_COREOGRAFICAS',
      nombre: { es: 'Composiciones coreográficas', 'pt-BR': 'Composições coreográficas' },
      categoriasHabilitadas: ['ADULTO_40'],
    },
  ],
  tiempos: [
    { formacion: 'SOLO', maxSegundos: 180 },
    { formacion: 'DUO', maxSegundos: 210 },
    { formacion: 'TRIO', maxSegundos: 210 },
    { formacion: 'GRUPO', maxSegundos: 300 },
    { formacion: 'QUADRO', maxSegundos: 600 },
  ],
  toleranciaGrupo: { porcentaje: 30, redondeo: 'FLOOR', direccion: 'AMBAS', soloAdyacentes: false },
  bandas: [
    { codigo: 'ORO', nombre: { es: 'Oro', 'pt-BR': 'Ouro' }, umbral: 9 },
    { codigo: 'PLATA', nombre: { es: 'Plata', 'pt-BR': 'Prata' }, umbral: 8 },
    { codigo: 'BRONCE', nombre: { es: 'Bronce', 'pt-BR': 'Bronze' }, umbral: 7 },
  ],
  puntaje: {
    escalaMin: 0,
    escalaMax: 10,
    decimalesNota: 1,
    decimalesResultado: 2,
    agregacion: 'PROMEDIO',
    umbralDesvio: 1.5,
    agrupacionRanking: ['categoria', 'formacion', 'genero'],
  },
  supuestos: [
    'categorias[*].edadMin/edadMax (salvo 40+)',
    'formaciones.GRUPO.integrantesMin',
    'formaciones.QUADRO (integrantes y tolerancia)',
    'generos (catálogo, salvo Reggaeton y Composições)',
    'tiempos (salvo Quadro 600 s)',
    'toleranciaGrupo.redondeo/direccion/soloAdyacentes',
    'fechaReferenciaEdad (eventos de varios días)',
    'bandas[*].nombre',
    'puntaje (escala, decimales, agregación, umbral de desvío)',
  ],
};
