'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ResetForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'weak_password') throw new Error('Senha fraca: use 8+ caracteres com 1 maiúscula e 1 número.');
        throw new Error('Link inválido ou expirado.');
      }
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
        Token ausente. Solicite um novo link em{' '}
        <a href="/forgot-password" className="text-purple-400">Recuperar senha</a>.
      </div>
    );
  }

  return done ? (
    <div className="space-y-4">
      <div className="p-3 text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg">
        Senha atualizada com sucesso.{' '}
        <a href="/login" className="text-purple-400">Entrar</a>.
      </div>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="new-password" className="text-sm font-medium text-gray-300">Nova senha</label>
        <input
          id="new-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
        />
        <p className="text-xs text-gray-500">Mínimo 8 caracteres, 1 maiúscula e 1 número.</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="confirm-password" className="text-sm font-medium text-gray-300">Confirmar nova senha</label>
        <input
          id="confirm-password"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
        />
      </div>
      {error && (
        <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{error}</div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? 'Atualizando...' : 'Atualizar senha'}
      </button>
    </form>
  );
}
