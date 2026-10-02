import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

const PESTANAS = [
  ['resumen', '/academia'],
  ['bailarines', '/academia/bailarines'],
  ['coreografias', '/academia/coreografias'],
  ['perfil', '/academia/perfil'],
] as const;

export async function PestanasAcademia({ activa }: { activa: (typeof PESTANAS)[number][0] }) {
  const t = await getTranslations('academia.pestanas');
  return (
    <nav aria-label={t('resumen')} className="-mx-1 flex gap-1 overflow-x-auto border-b border-borde">
      {PESTANAS.map(([clave, href]) => (
        <Link
          key={clave}
          href={href}
          aria-current={clave === activa ? 'page' : undefined}
          className="whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-texto-suave hover:text-texto aria-[current=page]:border-marca aria-[current=page]:text-texto"
        >
          {t(clave)}
        </Link>
      ))}
    </nav>
  );
}
