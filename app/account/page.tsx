'use client';

// Perfil e segurança da conta (FASE 5).
//  - exibe os dados da sessão autenticada (email, papel, organização);
//  - alteração de senha POR VOCÊ mesmo via Supabase Auth (GoTrue) self-service;
//  - recuperação de senha por e-mail encaminha para /forgot-password;
//  - troca de e-mail fica marcada como indisponível (não inventa recurso).

import AppNav from '@/components/AppNav';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Session {
  authenticated: boolean;
  role: string | null;
  organizationId: string | null;
  user: { id: string; email: string | null; email_verified: boolean };
}

function isStrong(p: string): boolean {
  return p.length >= 8 && /[A-Z]/.test(p) && /[0-9]/.test(p);
}

export default function AccountPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setSession(d);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <>
        <AppNav />
        <main className="min-h-screen p-4 sm:p-8 bg-[#05020A] text-gray-400 text-sm">
          Carregando sua conta…
        </main>
      </>
    );
  }

  if (!session?.authenticated) {
    return (
      <>
        <AppNav />
        <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
          <h1 className="text-2xl font-bold text-white mb-6">Meu perfil</h1>
          <div className="max-w-lg p-4 bg-[#0D0915] border border-white/10 rounded-2xl text-sm space-y-4">
            <p className="text-gray-400">Faça login para gerenciar sua conta e segurança.</p>
            <Link href="/login" className="inline-block px-4 py-2 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700">
              Entrar
            </Link>
          </div>
        </main>
      </>
    );
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    if (newPw !== confirmPw) {
      setResult({ ok: false, text: 'A nova senha e a confirmação não coincidem.' });
      return;
    }
    if (!isStrong(newPw)) {
      setResult({
        ok: false,
        text: 'A nova senha precisa ter ao menos 8 caracteres, 1 letra maiúscula e 1 número.',
      });
      return;
    }
    setBusy(true);
    try {
      // Self-service no próprio usuário logado (Supabase Auth / GoTrue).
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) {
        setResult({ ok: false, text: `Não foi possível alterar a senha: ${error.message}` });
      } else {
        setResult({
          ok: true,
          text: 'Senha atualizada com sucesso. Em outras sessões você precisará entrar de novo.',
        });
        setNewPw('');
        setConfirmPw('');
        setCurrentPw('');
      }
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Falha inesperada.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppNav />
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <h1 className="text-2xl font-bold text-white mb-2">Meu perfil</h1>
        <p className="text-sm text-gray-500 mb-6">Gestão da sua conta e segurança.</p>

        {/* Perfil */}
        <section className="p-4 sm:p-6 bg-[#0D0915] border border-white/10 rounded-2xl mb-6 max-w-2xl">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Perfil</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500">E-mail</dt>
            <dd className="text-gray-200">{session.user.email ?? '—'}</dd>
            <dt className="text-gray-500">E-mail verificado</dt>
            <dd className={session.user.email_verified ? 'text-green-400' : 'text-amber-400'}>
              {session.user.email_verified ? 'Sim' : 'Não verificado'}
            </dd>
            <dt className="text-gray-500">Papel na organização</dt>
            <dd className="text-gray-200">{session.role ?? 'não informado'}</dd>
            <dt className="text-gray-500">Organização</dt>
            <dd className="text-gray-300 truncate max-w-[220px]" title={session.organizationId ?? undefined}>
              {session.organizationId ?? '—'}
            </dd>
          </dl>
          <p className="text-xs text-gray-600 mt-4">
            Troca de e-mail: indisponível por autoatendimento. Procure o suporte do tenant para
            alterar o e-mail de login.
          </p>
        </section>

        {/* Alterar senha */}
        <section className="p-4 sm:p-6 bg-[#0D0915] border border-white/10 rounded-2xl mb-6 max-w-2xl">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Alterar minha senha
          </h2>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300">Senha atual</label>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-500"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300">Nova senha</label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-500"
                placeholder="Mín. 8, 1 maiúscula, 1 número"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300">Confirmar nova senha</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-500"
                placeholder="Repita a nova senha"
              />
            </div>
            {result && (
              <div
                className={`p-3 text-sm rounded-lg border ${
                  result.ok
                    ? 'text-green-400 bg-green-400/10 border-green-400/20'
                    : 'text-red-400 bg-red-400/10 border-red-400/20'
                }`}
              >
                {result.text}
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !newPw || !confirmPw}
              className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {busy ? 'Alterando…' : 'Alterar senha'}
            </button>
          </form>
        </section>

        {/* Recuperação por e-mail */}
        <section className="p-4 sm:p-6 bg-[#0D0915] border border-white/10 rounded-2xl max-w-2xl">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Esqueci minha senha
          </h2>
          <p className="text-sm text-gray-400 mb-3">
            Se você não lembra a senha, peça um link de recuperação por e-mail.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block px-4 py-2 text-sm font-semibold text-white border border-white/15 rounded-lg hover:bg-white/5"
          >
            Recuperar senha por e-mail
          </Link>
        </section>
      </main>
    </>
  );
}
