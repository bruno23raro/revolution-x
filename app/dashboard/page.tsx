'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

type Counts = {
  loading: boolean;
  unauthorized: boolean;
  error: boolean;
  contacts: number | null;
  deals: number | null;
  leads: number | null;
};

export default function DashboardPage() {
  const [state, setState] = useState<Counts>({
    loading: true,
    unauthorized: false,
    error: false,
    contacts: null,
    deals: null,
    leads: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [contacts, deals, leads] = await Promise.all([
          fetch('/api/crm/contacts').then((r) => r.json()),
          fetch('/api/crm/deals').then((r) => r.json()),
          fetch('/api/crm/leads').then((r) => r.json()),
        ]);
        if (cancelled) return;
        if (contacts?.error === 'Unauthorized' || deals?.error === 'Unauthorized' || leads?.error === 'Unauthorized') {
          setState({ loading: false, unauthorized: true, error: false, contacts: null, deals: null, leads: null });
        } else {
          setState({
            loading: false,
            unauthorized: false,
            error: false,
            contacts: Array.isArray(contacts?.items) ? contacts.items.length : null,
            deals: Array.isArray(deals?.items) ? deals.items.length : null,
            leads: Array.isArray(leads?.items) ? leads.items.length : null,
          });
        }
      } catch {
        if (!cancelled) setState({ loading: false, unauthorized: false, error: true, contacts: null, deals: null, leads: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return (
      <AppShell>
      <main className="min-h-screen p-8 bg-[#05020A] text-gray-400" aria-label="Dashboard">
        <h1 className="text-2xl font-bold text-white mb-6" aria-hidden="true">Dashboard</h1>
        {state.loading && <p className="text-gray-400" aria-live="polite">Carregando seus dados...</p>}
        {!state.loading && state.unauthorized && <p className="text-gray-400" aria-live="polite">Área protegida — faça login para ver seu dashboard e os dados da sua organização.</p>}
        {!state.loading && state.error && <p className="text-sm text-red-400" aria-live="polite">Não foi possível carregar os dados. O banco pode estar indisponível — verifique se a aplicação e o Supabase estão configurados.</p>}
      </main>
      </AppShell>
    );
  }

  if (state.unauthorized) {
    return (
      <AppShell>
      <main className="flex min-h-screen items-center justify-center p-4 bg-[#05020A]">
        <div className="max-w-md p-8 text-center space-y-4 bg-[#0D0915] border border-white/10 rounded-2xl">
          <h1 className="text-xl font-semibold text-white">Área protegida</h1>
          <p className="text-gray-400">Faça login para ver seu dashboard e os dados da sua organização.</p>
          <Link href="/login" className="inline-block py-2 px-4 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700">
            Entrar
          </Link>
        </div>
      </main>
      </AppShell>
    );
  }

  if (state.unauthorized) {
    return (
      <AppShell>
      <main className="flex min-h-screen items-center justify-center p-4 bg-[#05020A]">
        <div className="max-w-md p-8 text-center space-y-4 bg-[#0D0915] border border-white/10 rounded-2xl">
          <h1 className="text-xl font-semibold text-white">Área protegida</h1>
          <p className="text-gray-400">Faça login para ver seu dashboard e os dados da sua organização.</p>
          <Link href="/login" className="inline-block py-2 px-4 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700">
            Entrar
          </Link>
        </div>
      </main>
      </AppShell>
    );
  }

  if (state.error) {
    return (
      <AppShell>
      <main className="min-h-screen p-8 bg-[#05020A]">
        <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>
        <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
          Não foi possível carregar os dados. O banco pode estar indisponível — verifique se a aplicação e o
          Supabase estão configurados.
        </div>
      </main>
      </AppShell>
    );
  }

  const cards = [
    { label: 'Contatos', value: state.contacts, href: '/crm/contacts' },
    { label: 'Leads', value: state.leads, href: '/crm/leads' },
    { label: 'Deals', value: state.deals, href: '/crm/deals' },
  ];

  return (
    <AppShell>
    <main className="min-h-screen p-8 bg-[#05020A]">
      <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
      <p className="text-gray-400 mb-8">Visão geral da sua organização (dados reais, isolados por tenant).</p>
      <div className="grid gap-4 sm:grid-cols-3 max-w-3xl">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="block p-6 bg-[#0D0915] border border-white/10 rounded-2xl hover:border-purple-500/40 transition"
          >
            <div className="text-4xl font-bold text-white">{c.value ?? '—'}</div>
            <div className="text-gray-400 mt-1">
              {c.label} → <span className="text-purple-400">ver</span>
            </div>
          </Link>
        ))}
      </div>

      {/* FASE AGENT — entrada do Centro Administrativo com IA (acesso admin/owner) */}
      <div className="mt-6 max-w-3xl">
        <Link
          href="/admin/chat"
          className="flex items-center justify-between gap-4 p-4 bg-[#0D0915] border border-white/10 rounded-2xl hover:border-purple-500/40 transition"
        >
          <div>
            <div className="text-sm font-semibold text-gray-200">Centro Administrativo com IA</div>
            <div className="text-xs text-gray-500 mt-1">
              Descreva a tarefa em linguagem natural · acompanhe o progresso real das tarefas ·
              acesso restrito a admin/owner
            </div>
          </div>
          <span className="text-purple-400 shrink-0">abrir →</span>
        </Link>
      </div>

      {cards.every((c) => (c.value ?? 0) === 0) && (
        <p className="text-sm text-gray-500 mt-6">
          Ainda não há registros. Comece adicionando{' '}
          <Link href="/crm/contacts" className="text-purple-400">um contato</Link>.
        </p>
      )}
    </main>
    </AppShell>
  );
}
