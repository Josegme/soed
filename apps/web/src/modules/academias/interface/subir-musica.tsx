'use client';

import { Aviso } from '@soed/ui';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { formatearDuracion } from '@/lib/i18n/formato';
import { supabaseNavegador } from '@/lib/supabase/navegador';
import { registrarMusica } from './acciones';

const TIPOS = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac'];
const MAXIMO = 50 * 1024 * 1024;

/** Lee la duración real del archivo en el navegador (la valida el reglamento, TR-04). */
function leerDuracion(archivo: File): Promise<number> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (Number.isFinite(audio.duration)) resolver(Math.round(audio.duration));
      else rechazar(new Error('audio'));
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('audio'));
    };
    audio.src = url;
  });
}

/**
 * Sube la música directo a Storage (bucket privado "musica"; la política RLS
 * solo admite la carpeta de la academia) y registra ruta y duración (PR-08).
 */
export function SubirMusica({
  academiaId,
  coreografiaId,
  actual,
  supabaseUrl,
  supabaseClave,
}: {
  academiaId: string;
  coreografiaId: string;
  actual: { nombre: string | null; duracion: number | null };
  supabaseUrl: string;
  supabaseClave: string;
}) {
  const t = useTranslations('academia.coreografias');
  const te = useTranslations('errores');
  const id = useId();
  const [estado, setEstado] = useState<'libre' | 'subiendo' | 'ok' | 'error'>('libre');
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function alElegir(archivo: File | undefined) {
    if (!archivo) return;
    if (!TIPOS.includes(archivo.type) || archivo.size > MAXIMO) {
      setEstado('error');
      setMensaje(t('formatosMusica'));
      return;
    }
    setEstado('subiendo');
    setMensaje(null);
    try {
      const duracion = await leerDuracion(archivo);
      const extension = archivo.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
      const ruta = `${academiaId}/${coreografiaId}/${crypto.randomUUID()}.${extension}`;
      const db = supabaseNavegador(supabaseUrl, supabaseClave);
      const { error } = await db.storage.from('musica').upload(ruta, archivo, { contentType: archivo.type, upsert: false });
      if (error) throw error;
      const r = await registrarMusica({ coreografiaId, path: ruta, nombre: archivo.name.slice(0, 255), duracionSegundos: duracion });
      if (!r.ok) throw new Error(r.mensaje);
      setEstado('ok');
      setMensaje(t('musicaGuardada'));
    } catch (e) {
      setEstado('error');
      setMensaje(e instanceof Error && e.message === 'audio' ? t('errorMusica') : te('INESPERADO'));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        {actual.nombre && actual.duracion ? t('musicaCargada', { archivo: actual.nombre, duracion: formatearDuracion(actual.duracion) }) : t('sinMusica')}
      </p>
      <label htmlFor={id} className="inline-flex min-h-11 w-fit cursor-pointer items-center rounded-[var(--radio)] border border-borde bg-superficie px-4 text-sm font-semibold hover:bg-superficie-2 focus-within:ring-[3px] focus-within:ring-marca/60">
        {estado === 'subiendo' ? t('subiendo') : actual.nombre ? t('reemplazarMusica') : t('subirMusica')}
        <input id={id} type="file" accept={TIPOS.join(',')} className="sr-only" disabled={estado === 'subiendo'} onChange={(e) => alElegir(e.target.files?.[0])} />
      </label>
      <p className="text-xs text-texto-suave">{t('formatosMusica')}</p>
      {mensaje ? <Aviso tono={estado === 'ok' ? 'exito' : 'error'}>{mensaje}</Aviso> : null}
    </div>
  );
}
