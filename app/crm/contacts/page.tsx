'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

type Contact = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  waId?: string | null;
  createdAt?: string;
};

export default function ContactsPage() {
  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  // Create form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/contacts');
      const data = await res.json();
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (!res.ok) throw new Error('Falha ao carregar contatos');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao criar contato');
      setName('');
      setEmail('');
      setPhone('');
      await load();
    } catch (err: any) {
      setFormError(err.message === 'invalid_email' ? 'E-mail invÃ¡lido.' : err.message);
    } finally {
      setSaving(false);
    }
  };

  if (unauthorized) {
    return (
      <AppShell>
      <main className="min-h-screen p-8 bg-[#05020A]">
        <BackToCRM />
        <div className="p-3 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg mt-4">
          FaÃ§a login para ver os contatos da sua organizaÃ§Ã£o. <Link href="/login" className="text-purple-400">Entrar</Link>
        </div>
      </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
    <main className="min-h-screen p-8 bg-[#05020A]">
      <BackToCRM />
      <h1 className="text-2xl font-bold text-white mb-6">Contatos</h1>

      {loading ? (
        <p className="text-gray-400">Carregandoâ€¦</p>
      ) : error ? (
        <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{error}</div>
      ) : items.length === 0 ? (
        <p className="text-gray-500">Nenhum contato ainda. Cadastre o primeiro abaixo.</p>
      ) : (
        <div className="overflow-x-auto border border-white/10 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-[#0D0915] text-gray-400">
              <tr>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">E-mail</th>
                <th className="text-left p-3">Telefone</th>
                <th className="text-left p-3">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="text-gray-200">
              {items.map((c) => (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="p-3">{c.name}</td>
                  <td className="p-3 text-gray-400">{c.email ?? 'â€”'}</td>
                  <td className="p-3 text-gray-400">{c.phone ?? 'â€”'}</td>
                  <td className="p-3 text-gray-400">{c.waId ?? 'â€”'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-8 max-w-lg">
        <h2 className="text-lg font-semibold text-white mb-4">Novo contato</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Nome *"><input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label="E-mail"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
          <Field label="Telefone"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></Field>
          {formError && <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{formError}</div>}
          <button type="submit" disabled={saving} className="py-2 px-4 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
            {saving ? 'Salvandoâ€¦' : 'Adicionar'}
          </button>
        </form>
      </section>
    </main>
    </AppShell>
  );
}

function BackToCRM() {
  return <Link href="/crm" className="text-sm text-purple-400 hover:text-purple-300">â† Voltar ao CRM</Link>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      {children}
    </div>
  );
}
const inputCls =
  'w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500';
