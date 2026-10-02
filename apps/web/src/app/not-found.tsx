import { cliente } from '@/cliente';
import './globals.css';

/** 404 fuera de un idioma válido: redirige al idioma por defecto con un enlace simple. */
export default function NoEncontradoRaiz() {
  return (
    <html lang={cliente.idiomaDefecto}>
      <body className="flex min-h-dvh items-center justify-center p-6">
        <a href={`/${cliente.idiomaDefecto === 'pt-BR' ? 'pt' : 'es'}`} className="text-lg font-semibold underline">
          {cliente.nombre}
        </a>
      </body>
    </html>
  );
}
