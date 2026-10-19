'use client';

// Rota desconhecida → redireciona para a página inicial ("tudo redirecionando").
// Card de espera com auto-redirect (1,2 s) + link direto. Não expõe nada sensível.

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace('/'), 1200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#05020A] text-gray-300">
      <div className="max-w-md w-full text-center space-y-4 bg-[#0D0915] border border-white/10 rounded-2xl p-8">
        <div className="text-5xl font-black text-purple-400">404</div>
        <h1 className="text-xl font-semibold text-white">Página não encontrada</h1>
        <p className="text-sm text-gray-400">
          Este caminho não existe (ou foi movido). Redirecionando para a página inicial…
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700"
        >
          Voltar para a home
        </Link>
        <div className="text-xs text-gray-600">
          <Link href="/testcenter" className="text-purple-400/80 hover:text-purple-300">
            abrir o Centro de Testes
          </Link>
        </div>
      </div>
    </main>
  );
}
