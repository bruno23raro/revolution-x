'use client';

// FASE 17 — Lista + criação de campanhas (§1/§10/§11).
//
//  * Lista com contagens REAIS (sent/failed/skipped) — nunca métricas
//    fictícias (§10/§18).
//  * Criação: a campanha nasce `draft`; NENHUM envio acontece aqui.
//  * WhatsApp: o seletor de conta/número é POR OPERAÇÃO (§7/§11) — a conta
//    escolhida aqui é "ancorada" na criação, mas o detalhe da campanha
//    permite trocar antes de iniciar. Nunca há default silencioso.
//  * Canal email: criação é permitida, mas o envio é 409 honesto
//    (channel_not_available_yet) — a página deixa isso claro (§18).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

type Counts = { total: number; sent: number; failed: number; skipped: number };
type Campaign = {
  id: string;
  title: string;
  channel: string;
  status: string;
  resultKind?: string | null;
  accountId?: string | null;
  message: string;
  scheduledFor?: string | null;
  counts: Counts;
};
type WaAccount = {
  id: string;
  provider: string | null;
  displayName: string | null;
  phoneNumberId: string | null;
  status: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  awaiting_validation: 'Aguardando validação',
  scheduled: 'Agendada',
  queued: 'Em fila',
  running: 'Em execução',
  paused: 'Pausada',
  completed: 'Concluída',
  completed_partial: 'Concluída parcialmente',
  failed: 'Falhou',
  canceled: 'Cancelada',
};

const inputCls =
  'w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500';
const selectCls =
  'px-3 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white text-sm';

export default function CampaignsPage() {
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [accountsAvailable, setAccountsAvailable] = useState(false);

  // Formulário
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'email' | 'manual'>('whatsapp');
  const [message, setMessage] = useState('');
  const [accountId, setAccountId] = useState('');
  const [tags, setTags] = useState('');
  const [source, setSource] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [varsText, setVarsText] = useState('');
  const [batch, setBatch] = useState({ maxPerRun: '', delayMs: '', maxAttempts: '', backoffFactor: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/campaigns');
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (!res.ok) throw new Error('Falha ao carregar campanhas');
      const data = (await res.json()) as { items?: Campaign[] };
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    }
  }, []);

  useEffect(() => {
    load();
    // Contas de WhatsApp para o seletor POR OPERAÇÃO (§7/§11)
    fetch('/api/whatsapp/accounts')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { available?: boolean; accounts?: WaAccount[] } | null) => {
        if (!d) return;
        setAccountsAvailable(Boolean(d.available));
        setAccounts((d.accounts ?? []) as WaAccount[]);
      })
      .catch(() => {
        setAccountsAvailable(false);
      });
  }, [load]);

  const labelOf = (a: WaAccount) => a.displayName || a.phoneNumberId || a.id;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const variables: Record<string, string> = {};
      for (const line of varsText.split('\n')) {
        const idx = line.indexOf('=');
        if (idx <= 0) continue;
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k) variables[k] = v;
      }
      const body: Record<string, unknown> = {
        title,
        channel,
        message,
        resultKind: channel === 'manual' ? 'manual' : 'auto',
        audience: { tags: tags.split(',').map((t) => t.trim()).filter(Boolean), source: source || null },
      };
      if (channel === 'whatsapp' && accountId) body.accountId = accountId;
      if (scheduledFor) body.scheduledFor = new Date(scheduledFor).toISOString();
      if (Object.keys(variables).length > 0) body.variables = variables;
      const b: Record<string, number> = {};
      for (const [k, v] of Object.entries(batch)) {
        const n = Number(v);
        if (v !== '' && Number.isFinite(n)) b[k] = n;
      }
      if (Object.keys(b).length > 0) body.batch = b;

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; campaign?: { id?: string } };
      if (!res.ok) {
        const codes: Record<string, string> = {
          invalid_title: 'Informe um título (máx. 300).',
          invalid_channel: 'Canal inválido.',
          invalid_message: 'Informe a mensagem (máx. 4096).',
          invalid_scheduled_for: 'Data de agendamento inválida.',
          invalid_variables: 'Variáveis devem ser um objeto de texto.',
          too_many_variables: 'Máximo de 64 variáveis.',
          variable_too_long: 'Valor de variável excedeu 4000 caracteres.',
          invalid_audience_tags: 'Tags inválidas (máx. 10, cada uma 60).',
          invalid_account_id: 'Selecione uma conta válida para o WhatsApp.',
          invalid_batch_maxPerRun: 'Lote: maxPerRun deve ser 1–1000.',
          invalid_batch_delayMs: 'Lote: delayMs deve ser 250–30000.',
          invalid_batch_maxAttempts: 'Lote: maxAttempts deve ser 1–5.',
          invalid_batch_backoffFactor: 'Lote: backoffFactor deve ser 1–5.',
        };
        throw new Error(codes[data.error ?? ''] ?? data.error ?? 'Falha ao criar campanha');
      }
      setCreated(data.campaign?.id ?? null);
      setTitle('');
      setMessage('');
      setVarsText('');
      setTags('');
      setSource('');
      setScheduledFor('');
      setBatch({ maxPerRun: '', delayMs: '', maxAttempts: '', backoffFactor: '' });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setSaving(false);
    }
  };

  if (unauthorized) {
    return (
      <AppShell>
        <main className="min-h-screen p-8 bg-[#05020A]">
          <div className="p-3 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg">
            Faça login para gerenciar campanhas. <Link href="/login" className="text-purple-400">Entrar</Link>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen p-8 bg-[#05020A] max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-1">Campanhas e disparos</h1>
        <p className="text-sm text-gray-400 mb-6">
          Criação em rascunho + disparo em fila com resultados por destinatário. WhatsApp:
          escolha o número POR OPERAÇÃO — nunca há default silencioso.
        </p>

        {/* ── Nova campanha ───────────────────────────────────────────────── */}
        <section className="border border-white/10 rounded-lg p-5 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Nova campanha</h2>
          {created && (
            <div className="mb-4 p-3 text-sm text-green-300 bg-green-400/10 border border-green-400/20 rounded-lg">
              Campanha criada como rascunho: <Link href={`/campaigns/${created}`} className="text-purple-300 underline">abrir</Link>.
            </div>
          )}
          <form onSubmit={create} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Título *">
                <input required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Ex.: Promoção de junho" />
              </Field>
              <Field label="Canal *">
                <div className="flex gap-2">
                  {(['whatsapp', 'email', 'manual'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChannel(c)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                        channel === c
                          ? 'border-purple-500/50 bg-purple-600/20 text-white'
                          : 'border-white/15 text-gray-400 hover:text-white'
                      }`}
                    >
                      {c === 'whatsapp' ? 'WhatsApp' : c === 'email' ? 'E-mail (em breve)' : 'Manual'}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {channel === 'whatsapp' && (
              <Field label="Conta (número) de envio *">
                {accountsAvailable && accounts.length > 0 ? (
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectCls}>
                    <option value="">— Escolha o número que fará o envio —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{labelOf(a)}</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-amber-300">
                    Nenhuma conta de WhatsApp disponível nesta organização. Você pode salvar como
                    rascunho e iniciar depois de conectar um número (Canais e integrações).
                  </div>
                )}
              </Field>
            )}

            {channel === 'email' && (
              <div className="p-3 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg">
                O canal de e-mail ainda não está disponível para envio. A campanha pode ser criada
                e visualizada; o disparo responderá de forma honesta (canal não implementado).
              </div>
            )}

            {channel === 'manual' && (
              <div className="p-3 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg">
                Campanha manual: a plataforma NÃO envia nada. Ela serve para organizar a ação e
                registrar a confirmação que VOCÊ fez fora da RX («aguardando ação manual»).
              </div>
            )}

            <Field label="Mensagem * (use {{nome}}, {{empresa}}, {{telefone}}…)">
              <textarea required maxLength={4096} value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={inputCls} placeholder="Olá, {{nome}}! …" />
              <div className="text-[11px] text-gray-500 mt-1">Os valores do contato entram escapados: conteúdo de CSV/variável nunca executa HTML, JS ou SQL.</div>
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Tags da audiência">
                <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} placeholder="vip, clientes (separadas por vírgula)" />
              </Field>
              <Field label="Origem">
                <input value={source} onChange={(e) => setSource(e.target.value)} className={inputCls} placeholder="csv-import, loja…" />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Agendar para (opcional)">
                <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Variáveis extras (linha a linha: chave=valor)">
                <input value={varsText} onChange={(e) => setVarsText(e.target.value)} className={inputCls} placeholder="cupom=10OFF" />
              </Field>
            </div>

            <details className="text-sm text-gray-400">
              <summary className="cursor-pointer text-purple-400">Limites do lote (opcional)</summary>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <Field label="Mensagens por execução (1–1000)">
                  <input type="number" min={1} max={1000} value={batch.maxPerRun} onChange={(e) => setBatch({ ...batch, maxPerRun: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Pausa entre envios, ms (250–30000)">
                  <input type="number" min={250} max={30000} value={batch.delayMs} onChange={(e) => setBatch({ ...batch, delayMs: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Tentativas (1–5)">
                  <input type="number" min={1} max={5} value={batch.maxAttempts} onChange={(e) => setBatch({ ...batch, maxAttempts: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Fator de backoff (1–5)">
                  <input type="number" min={1} max={5} step="0.5" value={batch.backoffFactor} onChange={(e) => setBatch({ ...batch, backoffFactor: e.target.value })} className={inputCls} />
                </Field>
              </div>
            </details>

            {formError && <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{formError}</div>}

            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
              {saving ? 'Criando…' : 'Criar rascunho'}
            </button>
          </form>
        </section>

        {/* ── Lista ───────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Suas campanhas</h2>
          {error ? (
            <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{error}</div>
          ) : items === null ? (
            <p className="text-sm text-gray-500">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma campanha ainda. Crie a primeira acima.</p>
          ) : (
            <div className="overflow-x-auto border border-white/10 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-[#0D0915] text-gray-400">
                  <tr>
                    <th className="text-left p-3">Título</th>
                    <th className="text-left p-3">Canal</th>
                    <th className="text-left p-3">Estado</th>
                    <th className="text-left p-3">Total / Enviadas / Falhas / Puladas</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  {items.map((c) => (
                    <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="p-3">
                        <Link href={`/campaigns/${c.id}`} className="text-purple-300 hover:text-purple-200 font-medium">{c.title}</Link>
                      </td>
                      <td className="p-3 text-gray-400">{c.channel}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-xs text-gray-300">
                          {STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-400 font-mono text-xs">
                        {c.counts.total} / {c.counts.sent} / {c.counts.failed} / {c.counts.skipped}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-300 block">{label}</label>
      {children}
    </div>
  );
}
