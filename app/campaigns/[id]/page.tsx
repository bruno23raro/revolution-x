'use client';

// FASE 17 â€” Detalhe da campanha + aÃ§Ãµes da mÃ¡quina de estados (Â§10/Â§11/Â§12).
//
//  * AÃ§Ãµes derivadas do estado ATUAL (start/resume, pause, cancel,
//    mark_manual_complete, preview) â€” o servidor revalida (409 invalid_state
//    quando a mÃ¡quina de estados nÃ£o permite).
//  * WhatsApp: seletor de conta POR OPERAÃ‡ÃƒO (Â§7/Â§11). Se a campanha jÃ¡ tem
//    conta ancorada, ela comeÃ§a selecionada (escolha explÃ­cita na criaÃ§Ã£o),
//    mas pode ser trocada aqui. Nunca hÃ¡ default silencioso: sem escolha,
//    o servidor responde 409 account_selection_required.
//  * Canal email: envio 409 honesto (channel_not_available_yet).
//  * Canal manual: a RX NUNCA envia; "Concluir manualmente" registra a
//    confirmaÃ§Ã£o do usuÃ¡rio (Â§12).
//  * DestinatÃ¡rios: resultados REAIS por destinatÃ¡rio, paginados (Â§10).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
  variables?: unknown;
  audienceJson?: unknown;
  errorText?: string | null;
  manualNotes?: string | null;
  progress?: number | null;
  scheduledFor?: string | null;
};
type Recipient = {
  contactId: string;
  name: string | null;
  phone: string | null;
  status: string;
  attempts: number;
  externalMessageId: string | null;
  lastError: string | null;
  sentAt: string | null;
};
type WaAccount = { id: string; displayName: string | null; phoneNumberId: string | null; status: string | null };

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  awaiting_validation: 'Aguardando validaÃ§Ã£o',
  scheduled: 'Agendada',
  queued: 'Em fila',
  running: 'Em execuÃ§Ã£o',
  paused: 'Pausada',
  completed: 'ConcluÃ­da',
  completed_partial: 'ConcluÃ­da parcialmente',
  failed: 'Falhou',
  canceled: 'Cancelada',
};

const REC_STATUS: Record<string, string> = {
  pending: 'Pendente',
  sent: 'Enviado',
  failed: 'Falhou',
  skipped: 'Pulado',
};

const inputCls =
  'px-3 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white text-sm';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [accountId, setAccountId] = useState('');

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<Array<{ text: string; missing: string[] }> | null>(null);
  const [acting, setActing] = useState(false);

  // DestinatÃ¡rios (fila, Â§10)
  const [recStatus, setRecStatus] = useState('');
  const [recOffset, setRecOffset] = useState(0);
  const [recPage, setRecPage] = useState<Array<Recipient> | null>(null);
  const [recTotal, setRecTotal] = useState(0);

  const RECS_PER_PAGE = 50;

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error('Falha ao carregar a campanha');
      const data = (await res.json()) as { campaign?: Campaign; counts?: Counts };
      const c = data.campaign as Campaign;
      setCampaign(c);
      setCounts(data.counts ?? null);
      // Conta ancorada na criaÃ§Ã£o jÃ¡ vem selecionada (nunca default oculto).
      setAccountId(typeof c.accountId === 'string' ? c.accountId : '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    fetch('/api/whatsapp/accounts')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { accounts?: WaAccount[] } | null) => {
        if (d) setAccounts((d.accounts ?? []) as WaAccount[]);
      })
      .catch(() => {
        /* seletor fica vazio; o servidor revalida */
      });
  }, [load]);

  const loadRecipients = useCallback(async () => {
    const qs = new URLSearchParams();
    if (recStatus) qs.set('status', recStatus);
    qs.set('limit', String(RECS_PER_PAGE));
    qs.set('offset', String(recOffset));
    try {
      const res = await fetch(`/api/campaigns/${id}/recipients?${qs.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as { items?: Recipient[]; total?: number };
      setRecPage(data.items ?? []);
      setRecTotal(data.total ?? 0);
    } catch {
      /* fila indisponÃ­vel: a UI mostra o que tem */
    }
  }, [id, recStatus, recOffset]);

  useEffect(() => {
    if (campaign) loadRecipients();
  }, [campaign, loadRecipients]);

  const act = async (action: string, extra?: Record<string, unknown>) => {
    setActing(true);
    setMsg(null);
    setPreview(null);
    try {
      const body: Record<string, unknown> = { action, ...extra };
      if (action === 'start' || action === 'resume') {
        if (campaign?.channel === 'whatsapp' && accountId) body.accountId = accountId;
      }
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const codes: Record<string, string> = {
          invalid_state: `Estado atual nÃ£o permite essa aÃ§Ã£o (${data.from} â†’ ${data.to}).`,
          account_selection_required:
            'Selecione a conta (nÃºmero) que farÃ¡ o envio â€” nunca hÃ¡ default silencioso (Â§11).',
          account_unavailable: `Conta indisponÃ­vel: ${data.reason ?? ''}`,
          channel_not_available_yet:
            'Canal de e-mail ainda nÃ£o disponÃ­vel para envio (resposta honesta, sem mÃ©tricas fictÃ­cias).',
          not_manual_campaign: 'SÃ³ campanhas manuais podem ser concluÃ­das pela confirmaÃ§Ã£o do usuÃ¡rio.',
          unknown_action: 'AÃ§Ã£o desconhecida.',
        };
        const text = codes[data.error as string] ?? String(data.error ?? 'AÃ§Ã£o indisponÃ­vel');
        setMsg({ ok: false, text });
      } else {
        const d = data as { status?: string; note?: string; samples?: Array<{ text: string; missing: string[] }>; batch?: { sent: number; failed: number; remaining: number } };
        if (d.samples) setPreview(d.samples);
        let ok = `AÃ§Ã£o aplicada${d.status ? ` â€” estado: ${STATUS_LABEL[d.status] ?? d.status}` : ''}.`;
        if (d.batch) ok += ` Lote: ${d.batch.sent} enviadas, ${d.batch.failed} falhas, ${d.batch.remaining} restantes na fila.`;
        if (d.note) ok += ` ${d.note}`;
        setMsg({ ok: true, text: ok });
        await load();
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Erro inesperado' });
    } finally {
      setActing(false);
    }
  };

  if (unauthorized) {
    return (
      <AppShell>
        <main className="min-h-screen p-8 bg-[#05020A]">
          <div className="p-3 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg">
            FaÃ§a login para ver esta campanha. <Link href="/login" className="text-purple-400">Entrar</Link>
          </div>
        </main>
      </AppShell>
    );
  }
  if (notFound) {
    return (
      <AppShell>
        <main className="min-h-screen p-8 bg-[#05020A]">
          <p className="text-sm text-gray-400">
            Campanha nÃ£o encontrada (ou pertence a outra organizaÃ§Ã£o).{' '}
            <Link href="/campaigns" className="text-purple-400">Voltar Ã s campanhas</Link>
          </p>
        </main>
      </AppShell>
    );
  }

  const terminal = campaign && ['completed', 'completed_partial', 'canceled'].includes(campaign.status);
  const startable = campaign && ['draft', 'awaiting_validation', 'scheduled', 'queued', 'paused', 'failed'].includes(campaign.status);
  const pausable = campaign && ['queued', 'running'].includes(campaign.status);
  const cancellable = campaign && !terminal;
  const manualCompletable = campaign && campaign.resultKind === 'manual' && campaign.status === 'awaiting_validation';

  const labelOf = (a: WaAccount) => a.displayName || a.phoneNumberId || a.id;
  const selectedAccount = accounts.find((a) => a.id === accountId);

  return (
    <AppShell>
      <main className="min-h-screen p-8 bg-[#05020A] max-w-5xl mx-auto">
        <Link href="/campaigns" className="text-sm text-purple-400 hover:text-purple-300">â† Voltar Ã s campanhas</Link>

        {loading ? (
          <p className="text-gray-400 mt-6">Carregandoâ€¦</p>
        ) : error ? (
          <div className="mt-6 p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{error}</div>
        ) : campaign ? (
          <div className="mt-6 space-y-8">
            {/* CabeÃ§alho */}
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white">{campaign.title}</h1>
                <span className="px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-xs text-gray-300">
                  {STATUS_LABEL[campaign.status] ?? campaign.status}
                </span>
              </div>
              <div className="text-sm text-gray-400 mt-1">
                Canal: <strong className="text-gray-300">{campaign.channel}</strong>
                {campaign.scheduledFor ? ` Â· Agendada para ${new Date(campaign.scheduledFor).toLocaleString('pt-BR')}` : ''}
              </div>

              {campaign.channel === 'email' && (
                <div className="mt-3 p-3 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg">
                  O canal de e-mail ainda nÃ£o estÃ¡ disponÃ­vel para envio. O disparo responderÃ¡ de
                  forma honesta (channel_not_available_yet) â€” a plataforma nÃ£o inventa mÃ©tricas.
                </div>
              )}
              {campaign.channel === 'manual' && (
                <div className="mt-3 p-3 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg">
                  Campanha manual: a Revolution X NÃƒO envia mensagens. A conclusÃ£o Ã© registrada
                  apenas quando VOCÃŠ confirma a aÃ§Ã£o que tomou fora da plataforma.
                </div>
              )}
              {campaign.errorText && (
                <div className="mt-3 p-3 text-xs text-red-300 bg-red-400/10 border border-red-400/20 rounded-lg">
                  Ãšltimo erro: {campaign.errorText}
                </div>
              )}
              {campaign.manualNotes && (
                <div className="mt-3 p-3 text-xs text-gray-300 bg-black/40 border border-white/10 rounded-lg">
                  Nota de conclusÃ£o: {campaign.manualNotes}
                </div>
              )}
            </div>

            {/* AÃ§Ãµes */}
            <div className="border border-white/10 rounded-lg p-5 space-y-4">
              <h2 className="text-lg font-semibold text-white">AÃ§Ãµes</h2>

              {campaign.channel === 'whatsapp' && (
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">
                    Conta (nÃºmero) que farÃ¡ o envio
                  </label>
                  {accounts.length > 0 ? (
                    <div className="flex items-center gap-3">
                      <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
                        <option value="">â€” Escolha o nÃºmero â€”</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>{labelOf(a)}</option>
                        ))}
                      </select>
                      {selectedAccount && (
                        <span className="text-xs text-gray-500">
                          {selectedAccount.displayName ? 'Ligada a ' : ''}{selectedAccount.phoneNumberId}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-amber-300">
                      Nenhuma conta de WhatsApp disponÃ­vel nesta organizaÃ§Ã£o. Conecte um nÃºmero em{' '}
                      <Link href="/whatsapp" className="underline">Canais e integraÃ§Ãµes</Link> antes de iniciar.
                    </div>
                  )}
                  <div className="text-[11px] text-gray-500 mt-1">
                    A escolha Ã© POR OPERAÃ‡ÃƒO: sem nÃºmero selecionado, o servidor recusa o disparo (nunca default silencioso).
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {startable && campaign.channel !== 'email' && (
                  <button
                    onClick={() => act(campaign.status === 'paused' || campaign.status === 'failed' ? 'resume' : 'start')}
                    disabled={acting || (campaign.channel === 'whatsapp' && !accountId)}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {campaign.status === 'paused' || campaign.status === 'failed' ? 'Retomar' : 'Iniciar disparo'}
                  </button>
                )}
                {pausable && (
                  <button onClick={() => act('pause')} disabled={acting} className="px-4 py-2 text-sm rounded-lg border border-white/15 text-gray-200 hover:bg-white/5 disabled:opacity-50">
                    Pausar
                  </button>
                )}
                {cancellable && (
                  <button onClick={() => act('cancel')} disabled={acting} className="px-4 py-2 text-sm rounded-lg border border-red-400/30 text-red-300 hover:bg-red-400/10 disabled:opacity-50">
                    Cancelar
                  </button>
                )}
                {manualCompletable && (
                  <button onClick={() => act('mark_manual_complete')} disabled={acting} className="px-4 py-2 text-sm rounded-lg border border-green-400/30 text-green-300 hover:bg-green-400/10 disabled:opacity-50">
                    Confirmar conclusÃ£o manual
                  </button>
                )}
                {!terminal && (
                  <button onClick={() => act('preview')} disabled={acting} className="px-4 py-2 text-sm rounded-lg border border-white/15 text-gray-300 hover:bg-white/5 disabled:opacity-50">
                    PrÃ©via (nada Ã© enviado)
                  </button>
                )}
              </div>

              {msg && (
                <div className={`p-3 text-sm rounded-lg ${msg.ok ? 'text-green-300 bg-green-400/10 border border-green-400/20' : 'text-red-300 bg-red-400/10 border border-red-400/20'}`}>
                  {msg.text}
                </div>
              )}

              {preview && (
                <div>
                  <div className="text-sm text-gray-400 mb-2">Amostras interpoladas (prÃ©via â€” nenhuma mensagem foi enviada):</div>
                  <div className="space-y-2">
                    {preview.map((s, i) => (
                      <div key={i} className="p-3 bg-black/40 border border-white/10 rounded-lg text-sm text-gray-200 whitespace-pre-wrap">
                        {s.text}
                        {s.missing.length > 0 && (
                          <div className="mt-1 text-[11px] text-amber-300">variÃ¡veis ausentes: {s.missing.join(', ')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Contagens reais */}
            {counts && (
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">Progresso (mÃ©tricas reais)</h2>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    ['Total', counts.total],
                    ['Enviadas', counts.sent],
                    ['Falhas', counts.failed],
                    ['Puladas', counts.skipped],
                  ].map(([label, n]) => (
                    <div key={label} className="p-3 bg-black/40 border border-white/10 rounded-lg">
                      <div className="text-2xl font-bold text-white">{n as number}</div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-400">{label as string}</div>
                    </div>
                  ))}
                </div>
                {typeof campaign.progress === 'number' && (
                  <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, Math.max(0, campaign.progress))}%` }} />
                  </div>
                )}
              </div>
            )}

            {/* DestinatÃ¡rios */}
            <div>
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <h2 className="text-lg font-semibold text-white">DestinatÃ¡rios (fila)</h2>
                <div className="flex items-center gap-2">
                  <select value={recStatus} onChange={(e) => { setRecStatus(e.target.value); setRecOffset(0); }} className={inputCls}>
                    <option value="">Todos</option>
                    <option value="pending">Pendentes</option>
                    <option value="sent">Enviados</option>
                    <option value="failed">Falhas</option>
                    <option value="skipped">Pulados</option>
                  </select>
                </div>
              </div>

              {recPage === null ? (
                <p className="text-sm text-gray-500">Carregando filaâ€¦</p>
              ) : recPage.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {counts && counts.total > 0
                    ? 'Nenhum destinatÃ¡rio com esse filtro.'
                    : 'Ainda nÃ£o hÃ¡ fila: inicie o disparo para planejar os destinatÃ¡rios.'}
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto border border-white/10 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-[#0D0915] text-gray-400">
                        <tr>
                          <th className="text-left p-3">Contato</th>
                          <th className="text-left p-3">Telefone</th>
                          <th className="text-left p-3">Status</th>
                          <th className="text-left p-3">Tentativas</th>
                          <th className="text-left p-3">Enviado em</th>
                          <th className="text-left p-3">Ãšltimo erro</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-200">
                        {recPage.map((r) => (
                          <tr key={r.contactId} className="border-t border-white/5">
                            <td className="p-3">{r.name ?? r.contactId.slice(0, 8)}</td>
                            <td className="p-3 text-gray-400 font-mono text-xs">{r.phone ?? 'â€”'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs border ${
                                r.status === 'sent'
                                  ? 'text-green-300 border-green-400/30 bg-green-400/10'
                                  : r.status === 'failed'
                                    ? 'text-red-300 border-red-400/30 bg-red-400/10'
                                    : r.status === 'skipped'
                                      ? 'text-gray-400 border-white/15 bg-black/40'
                                      : 'text-amber-300 border-amber-400/30 bg-amber-400/10'
                              }`}>
                                {REC_STATUS[r.status] ?? r.status}
                              </span>
                            </td>
                            <td className="p-3 text-gray-400">{r.attempts}</td>
                            <td className="p-3 text-gray-400 text-xs">{r.sentAt ? new Date(r.sentAt).toLocaleString('pt-BR') : 'â€”'}</td>
                            <td className="p-3 text-gray-500 text-xs max-w-[220px] truncate" title={r.lastError ?? undefined}>
                              {r.lastError ?? 'â€”'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-sm text-gray-400">
                    <span>{recTotal} destinatÃ¡rio(s)</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRecOffset(Math.max(0, recOffset - RECS_PER_PAGE))}
                        disabled={recOffset === 0}
                        className="px-3 py-1 rounded-lg border border-white/15 hover:bg-white/5 disabled:opacity-40"
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() => setRecOffset(recOffset + RECS_PER_PAGE)}
                        disabled={recOffset + RECS_PER_PAGE >= recTotal}
                        className="px-3 py-1 rounded-lg border border-white/15 hover:bg-white/5 disabled:opacity-40"
                      >
                        PrÃ³xima
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
