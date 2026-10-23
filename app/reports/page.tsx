'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

type Report = {
  loading: boolean;
  unauthorized: boolean;
  error: boolean;
  contacts: number;
  leads: number;
  deals: number;
  dealsByStage: Record<string, number>;
  leadsByStatus: Record<string, number>;
};

const EMPTY: Report = {
  loading: true,
  unauthorized: false,
  error: false,
  contacts: 0,
  leads: 0,
  deals: 0,
  dealsByStage: {},
  leadsByStatus: {},
};

function tally(items: any[], key: string, out: Record<string, number>) {
  for (const i of items) {
    const k = i?.[key];
    if (k) out[k] = (out[k] ?? 0) + 1;
  }
}

export default function ReportsPage() {
  const [r, setR] = useState<Report>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, l, d] = await Promise.all([
          fetch('/api/crm/contacts').then((x) => x.json()),
          fetch('/api/crm/leads').then((x) => x.json()),
          fetch('/api/crm/deals').then((x) => x.json()),
        ]);
        if (cancelled) return;
        if (c?.error === 'Unauthorized' || l?.error === 'Unauthorized' || d?.error === 'Unauthorized') {
          setR({ ...EMPTY, loading: false, unauthorized: true });
          return;
        }
        const deals: any[] = Array.isArray(d?.items) ? d.items : [];
        const leads: any[] = Array.isArray(l?.items) ? l.items : [];
        const contacts: any[] = Array.isArray(c?.items) ? c.items : [];
        const dealsByStage: Record<string, number> = {};
        const leadsByStatus: Record<string, number> = {};
        tally(deals, 'stage', dealsByStage);
        tally(leads, 'status', leadsByStatus);
        setR({
          loading: false,
          unauthorized: false,
          error: false,
          contacts: contacts.length,
          leads: leads.length,
          deals: deals.length,
          dealsByStage,
          leadsByStatus,
        });
      } catch {
        if (!cancelled) setR({ ...EMPTY, loading: false, error: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (r.loading)
    return (
      <AppShell>
        <main className="min-h-screen p-8 bg-[#05020A] text-gray-400">Carregando relatório…</main>
      </AppShell>
    );

  if (r.unauthorized) {
    return (
      <AppShell>
        <main className="flex min-h-screen items-center justify-center p-4 bg-[#05020A]">
          <div className="max-w-md p-8 text-center space-y-4 bg-[#0D0915] border border-white/10 rounded-2xl">
            <h1 className="text-xl font-semibold text-white">Relatórios</h1>
            <p className="text-gray-400">Faça login para ver o relatório da sua organização.</p>
            <Link href="/login" className="inline-block py-2 px-4 font-semibold text-white bg-purple-600 rounded-lg">Entrar</Link>
          </div>
        </main>
      </AppShell>
    );
  }

  if (r.error) {
    return (
      <AppShell>
        <main className="min-h-screen p-8 bg-[#05020A]">
          <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
            Não foi possível gerar o relatório. Banco indisponível?
          </div>
        </main>
      </AppShell>
    );
  }

  const dealsStages = Object.entries(r.dealsByStage);
  const leadsStatuses = Object.entries(r.leadsByStatus);

  return (
    <AppShell>
    <main className="min-h-screen p-8 bg-[#05020A]">
      <h1 className="text-2xl font-bold text-white mb-2">Relatórios — CRM</h1>
      <p className="text-gray-400 mb-8">Métricas reais da sua organização (isolado por tenant).</p>

      <div className="grid gap-4 sm:grid-cols-3 max-w-3xl mb-8">
        <Metric label="Contatos" value={r.contacts} />
        <Metric label="Leads" value={r.leads} />
        <Metric label="Deals" value={r.deals} />
      </div>

      <div className="grid gap-8 md:grid-cols-2 max-w-4xl">
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Deals por etapa</h2>
          {dealsStages.length === 0 ? (
            <p className="text-gray-500 text-sm">Sem deals ainda.</p>
          ) : (
            <ul className="space-y-2">
              {dealsStages.map(([stage, n]) => (
                <li key={stage} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300 capitalize">{stage}</span>
                  <span className="text-purple-300 font-semibold">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Leads por status</h2>
          {leadsStatuses.length === 0 ? (
            <p className="text-gray-500 text-sm">Sem leads ainda.</p>
          ) : (
            <ul className="space-y-2">
              {leadsStatuses.map(([status, n]) => (
                <li key={status} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300 capitalize">{status}</span>
                  <span className="text-purple-300 font-semibold">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-6 bg-[#0D0915] border border-white/10 rounded-2xl">
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-gray-400 mt-1">{label}</div>
    </div>
  );
}
