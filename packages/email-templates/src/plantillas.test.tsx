import { describe, expect, it } from 'vitest';
import { renderizarComunicado, renderizarTransaccional } from './plantillas';

const marca = { nombre: 'Encuentro de Danzas', colorMarca: '#0b3a46', colorAcento: '#f2b53a', urlSitio: 'https://x', pie: 'Pie' };

describe('[TR-22] [PR-22] emails en el idioma del destinatario', () => {
  it('renderiza en portugués con lang, detalle y acción', async () => {
    const r = await renderizarTransaccional({
      idioma: 'pt-BR',
      marca,
      vistaPrevia: 'Demonstrativo emitido',
      titulo: 'Seu demonstrativo está pronto',
      parrafos: ['Olá, Academia Uno.'],
      detalle: [{ etiqueta: 'Número', valor: 'LIQ-SELA-0001' }],
      accion: { texto: 'Baixar PDF', url: 'https://x/liq' },
      nota: 'Este documento não é uma fatura.',
    });
    expect(r.html).toContain('lang="pt-BR"');
    expect(r.html).toContain('LIQ-SELA-0001');
    expect(r.texto).toContain('Este documento não é uma fatura.');
  });
  it('renderiza comunicados con párrafos y escapa HTML del organizador', async () => {
    const r = await renderizarComunicado({
      idioma: 'es',
      marca,
      vistaPrevia: 'Aviso',
      asunto: 'Cronograma',
      cuerpo: 'Hola\n\n<script>x</script>',
    });
    expect(r.html).toContain('Cronograma');
    expect(r.html).not.toContain('<script>x</script>');
  });
});
