import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const conNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseWs = supabase.replace(/^http/, 'ws');

/**
 * CSP v1: scripts 'self' + 'unsafe-inline' (requerido por la hidratación de Next
 * sin nonce). Pendiente S-03 de la revisión de seguridad: migrar a CSP con nonce
 * en proxy.ts cuando las páginas públicas no necesiten render estático.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} ${supabaseWs}`.trim(),
  `media-src 'self' blob: ${supabase}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const config: NextConfig = {
  // El e2e del panel compila con otra URL de Supabase: directorio propio para no pisar el build normal.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@soed/domain', '@soed/shared-types', '@soed/ui', '@soed/email-templates'],
  serverExternalPackages: ['@react-pdf/renderer'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // La cámara se usa para escanear QR en acreditación (OP-17).
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default conNextIntl(config);
