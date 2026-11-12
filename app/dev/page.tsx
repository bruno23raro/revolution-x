'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DevModePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<'login' | 'logout' | null>(null);
  const router = useRouter();

  async function handleDemoLogin() {
    setAction('login');
    setError(null);

    try {
      const response = await fetch('/api/dev/demo-login', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || data.error || 'Falha ao entrar no modo demo');
        return;
      }

      // Redirecionar para o dashboard após login demo
      router.push('/dashboard');
    } catch (e) {
      setError('Erro de rede');
    } finally {
      setAction(null);
    }
  }

  async function handleDemoLogout() {
    setAction('logout');
    setError(null);

    try {
      const response = await fetch('/api/dev/clear-demo-session', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Falha ao sair do modo demo');
        return;
      }

      // Redirecionar para a página de login
      router.push('/login');
    } catch (e) {
      setError('Erro de rede');
    } finally {
      setAction(null);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Modo Desenvolvimento
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Entre no ambiente de demonstração com dados fictícios.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={handleDemoLogin}
          disabled={loading && action === 'login'}
          className="w-full py-3 px-4 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && action === 'login' ? 'Entrando...' : 'Entrar no Modo Demo'}
        </button>

        <button
          onClick={handleDemoLogout}
          disabled={loading && action === 'logout'}
          className="w-full py-3 px-4 rounded-lg font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && action === 'logout' ? 'Saindo...' : 'Sair do Modo Demo'}
        </button>

        <div className="text-center text-xs text-gray-500 dark:text-gray-400">
          <p>Demo mode só funciona quando RX_DEMO_MODE=1 e NODE_ENV!=production</p>
        </div>
      </div>
    </div>
  );
}