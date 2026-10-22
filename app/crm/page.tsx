// FASE 3/6 — Tela CRM (REAL, navegável, isolada por tenant)
import Link from 'next/link';
import AppShell from '@/components/AppShell';

export default function CRMPage() {
  return (
    <AppShell>
      <main className="min-h-screen p-8 bg-[#05020A]">
      <h1 className="text-2xl font-bold text-white mb-2">CRM</h1>
      <p className="text-gray-400 mb-6">
        Contatos, leads e deals da sua organização. Cada tenant só vê os próprios dados (RLS).
      </p>
      <nav className="grid gap-4 sm:grid-cols-3 max-w-3xl">
        <Link
          href="/crm/contacts"
          className="block p-6 bg-[#0D0915] border border-white/10 rounded-2xl hover:border-purple-500/40 transition"
        >
          <div className="text-xl font-semibold text-white">Contatos</div>
          <div className="text-gray-500 text-sm mt-1">Clientes e Leads (WhatsApp)</div>
        </Link>
        <Link
          href="/crm/leads"
          className="block p-6 bg-[#0D0915] border border-white/10 rounded-2xl hover:border-purple-500/40 transition"
        >
          <div className="text-xl font-semibold text-white">Leads</div>
          <div className="text-gray-500 text-sm mt-1">Origem e status do funil</div>
        </Link>
        <Link
          href="/crm/deals"
          className="block p-6 bg-[#0D0915] border border-white/10 rounded-2xl hover:border-purple-500/40 transition"
        >
          <div className="text-xl font-semibold text-white">Deals</div>
          <div className="text-gray-500 text-sm mt-1">Oportunidades e valores</div>
        </Link>
      </nav>
    </main>
    </AppShell>
  );
}
