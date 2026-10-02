import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { requerirSesion } from '@/lib/auth/sesion';

/** Solo Super Admin (SA-*). La RLS lo vuelve a exigir en cada tabla. */
export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const { sesion } = await requerirSesion();
  if (!sesion.esSuperAdmin) redirect({ href: '/panel', locale: await getLocale() });
  return children;
}
