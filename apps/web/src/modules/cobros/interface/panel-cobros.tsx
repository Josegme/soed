import { montoSugerido, type Idioma, type Moneda } from '@soed/domain';
import { CampoSelector, CampoTexto, EstadoVacio, Insignia, Tabla, Td, Th } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { FormularioAccion } from '@/components/formulario-accion';
import { etiquetaCodigo } from '@/lib/i18n/claves';
import { formatearMonto } from '@/lib/i18n/formato';
import { registrarCobroAccion } from './acciones';
import { CobroOffline } from './cobro-offline';

export interface LiquidacionFila {
  id: string;
  numero: string;
  academia: string;
  total: number;
  cobrado: number;
  saldo: number;
  estado: string;
  version: number | null;
}

const tonoEstado = (estado: string) =>
  estado === 'PAGADA' ? 'exito' : estado === 'PARCIAL' ? 'alerta' : estado === 'SIN_CARGO' ? 'neutro' : 'info';

/**
 * Liquidaciones con saldo y registro de cobro en línea (OR-26 a OR-29, OP-20).
 * Se usa en el panel del organizador y en la mesa de caja del staff.
 */
export async function TablaLiquidaciones({
  liquidaciones,
  moneda,
  medios,
  idioma,
  puedeCobrar,
  offline,
}: {
  liquidaciones: readonly LiquidacionFila[];
  moneda: Moneda;
  medios: readonly string[];
  idioma: Idioma;
  puedeCobrar: boolean;
  /** Mesa de caja: el cobro pasa por la cola offline del usuario (ADR-0010). */
  offline?: { usuarioId: string };
}) {
  const t = await getTranslations('gestion.cobros');
  const tl = await getTranslations('estados.liquidacion');
  const tm = await getTranslations('medios');
  const monto = (c: number) => formatearMonto(c, moneda, idioma);
  const decimal = (c: number) => (c / 100).toFixed(2).replace('.', idioma === 'es' || idioma === 'pt-BR' ? ',' : '.');
  if (liquidaciones.length === 0) return <EstadoVacio titulo={t('sinLiquidaciones')} descripcion={t('sinLiquidacionesDetalle')} />;
  return (
    <Tabla>
      <caption className="sr-only">{t('liquidaciones')}</caption>
      <thead>
        <tr>
          <Th scope="col">{t('numero')}</Th>
          <Th scope="col">{t('academia')}</Th>
          <Th scope="col" className="text-right">
            {t('total')}
          </Th>
          <Th scope="col" className="text-right">
            {t('cobrado')}
          </Th>
          <Th scope="col" className="text-right">
            {t('saldo')}
          </Th>
          <Th scope="col">{t('estado')}</Th>
        </tr>
      </thead>
      <tbody>
        {liquidaciones.map((l) => (
          <tr key={l.id} className="border-t border-borde align-top">
            <Td className="font-mono text-xs">{l.numero}</Td>
            <Td>
              <div className="flex flex-col gap-2">
                <span className="font-medium">{l.academia}</span>
                {puedeCobrar && l.saldo > 0 && l.version !== null ? (
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-marca">{t('registrarCobro')}</summary>
                    {offline ? (
                      <CobroOffline
                        usuarioId={offline.usuarioId}
                        liquidacionId={l.id}
                        numero={l.numero}
                        moneda={moneda}
                        medios={medios.map((m) => ({ valor: m, etiqueta: etiquetaCodigo(tm, m) }))}
                        montoSugerido={decimal(montoSugerido(l.saldo))}
                      />
                    ) : (
                      <FormularioAccion
                        accion={registrarCobroAccion}
                        namespace="gestion.cobros"
                        boton={t('confirmarCobro')}
                        tamano="chico"
                        idempotente
                        className="mt-2 max-w-md"
                      >
                        <input type="hidden" name="liquidacionId" value={l.id} />
                        <input type="hidden" name="moneda" value={moneda} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <CampoTexto
                            name="monto"
                            etiqueta={t('monto', { moneda })}
                            inputMode="decimal"
                            defaultValue={decimal(montoSugerido(l.saldo))}
                            requerido
                          />
                          <CampoSelector
                            name="medio"
                            etiqueta={t('medio')}
                            opciones={medios.map((m) => ({ valor: m, etiqueta: etiquetaCodigo(tm, m) }))}
                          />
                        </div>
                        <CampoTexto name="referencia" etiqueta={t('referencia')} maxLength={200} />
                        <CampoTexto name="nota" etiqueta={t('nota')} maxLength={1000} />
                      </FormularioAccion>
                    )}
                  </details>
                ) : null}
              </div>
            </Td>
            <Td className="text-right tabular-nums">{monto(l.total)}</Td>
            <Td className="text-right tabular-nums">{monto(l.cobrado)}</Td>
            <Td className="text-right font-semibold tabular-nums">{monto(l.saldo)}</Td>
            <Td>
              <Insignia tono={tonoEstado(l.estado)}>{tl(l.estado as 'PAGADA')}</Insignia>
            </Td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}
