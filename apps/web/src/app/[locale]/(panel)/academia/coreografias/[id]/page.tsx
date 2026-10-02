import { EncabezadoPagina, Tarjeta } from '@soed/ui';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PestanasAcademia } from '@/components/panel/pestanas-academia';
import { requerirSesion } from '@/lib/auth/sesion';
import { entornoPublico } from '@/lib/entorno';
import { academiaActiva, listarBailarines, listarCoreografias, reglamentoDeReferencia } from '@/modules/academias/infrastructure/consultas';
import { FormularioCoreografia } from '@/modules/academias/interface/formularios';
import { SubirMusica } from '@/modules/academias/interface/subir-musica';

export default async function EditarCoreografia({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const { sesion, db } = await requerirSesion();
  const academia = academiaActiva(sesion);
  if (!academia) notFound();
  const t = await getTranslations('academia.coreografias');
  const [coreografias, bailarines, reglamento] = await Promise.all([
    listarCoreografias(db, academia.id),
    listarBailarines(db, academia.id),
    reglamentoDeReferencia(db),
  ]);
  const c = coreografias.find((x) => x.id === id);
  if (!c) notFound();
  const entorno = entornoPublico();
  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo={c.nombre} />
      <PestanasAcademia activa="coreografias" />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Tarjeta>
          <FormularioCoreografia
            academiaId={academia.id}
            reglamento={reglamento}
            bailarines={bailarines.filter((b) => b.activo).map((b) => ({ id: b.id, nombre: `${b.apellido}, ${b.nombre}` }))}
            coreografia={{
              id: c.id,
              nombre: c.nombre,
              genero: c.genero,
              formacion: c.formacion,
              coreografo: c.coreografo,
              elenco: c.coreografia_bailarin.map((e) => ({ bailarinId: e.bailarin_id, esCoreografo: e.es_coreografo })),
            }}
          />
        </Tarjeta>
        <Tarjeta className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">{t('musica')}</h2>
          {entorno ? (
            <SubirMusica
              academiaId={academia.id}
              coreografiaId={c.id}
              actual={{ nombre: c.musica_nombre, duracion: c.musica_duracion_seg }}
              supabaseUrl={entorno.supabaseUrl}
              supabaseClave={entorno.supabaseClave}
            />
          ) : null}
        </Tarjeta>
      </div>
    </div>
  );
}
