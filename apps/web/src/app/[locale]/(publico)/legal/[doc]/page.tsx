import { Aviso, EncabezadoPagina } from '@soed/ui';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { cliente } from '@/cliente';
import { texto } from '@/lib/i18n/traducible';
import { idiomaDe } from '@/lib/i18n/locales';

const DOCUMENTOS = { terminos: 'terminos', privacidad: 'privacidad' } as const;

export function generateStaticParams() {
  return Object.keys(DOCUMENTOS).map((doc) => ({ doc }));
}

export default async function Legal({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { doc } = await params;
  const locale = idiomaDe((await params).locale);
  setRequestLocale(locale);
  if (!(doc in DOCUMENTOS)) notFound();
  const clave = DOCUMENTOS[doc as keyof typeof DOCUMENTOS];
  const t = await getTranslations('legal');
  const contenido = texto(cliente.legal[clave], locale, cliente.idiomaDefecto);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <EncabezadoPagina titulo={t(clave)} />
      {contenido ? (
        <div className="whitespace-pre-line">{contenido}</div>
      ) : (
        <Aviso tono="info">{t('pendiente', { email: cliente.legal.contactoEmail })}</Aviso>
      )}
    </div>
  );
}
