'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar a conta');
      setSent(true);
      // Supabase requires email confirmation before login.
      setTimeout(() => router.push('/verify-email'), 1200);
    } catch (err: any) {
      setError(err.message === 'registration_failed' ? 'Não foi possível criar a conta. Tente novamente.' : err.message);
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-[#05020A]">
      <div className="w-full max-w-md p-8 space-y-6 bg-[#0D0915] border border-white/10 rounded-2xl shadow-2xl">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Criar conta</h1>
          <p className="text-gray-400">Registre-se no Revolution X</p>
        </div>

        {sent ? (
          <div className="p-3 text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg">
            Conta criada! Verifique seu e-mail para confirmar. Redirecionando…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-gray-300">Nome</label>
              <input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-300">E-mail</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500"
                placeholder="seu@email.com"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-300">Senha</label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
              />
              <p className="text-xs text-gray-500">Mínimo 8 caracteres, 1 maiúscula e 1 número.</p>
            </div>
            {error && (
              <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Criando...' : 'Criar conta'}
            </button>
          </form>
        )}

        <div className="text-sm text-center text-gray-500">
          Já tem uma conta?{' '}
          <a href="/login" className="text-purple-400 hover:text-purple-300">Entrar</a>
        </div>
      </div>
    </main>
  );
}
