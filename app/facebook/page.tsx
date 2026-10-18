'use client';

// Facebook — FASE 2 UI (canais principais).
//
//  • Publicação e agendamento de posts de Página pela Graph API oficial da
//    Meta (/api/facebook/publish): 10 min a 75 dias.
//  • FASE 3: tracking de anúncios em tempo real via Marketing API
//    (Ad Manager, /api/meta/ads-insights) — exige o ID da conta de
//    anúncios em /integrations (Meta Ads) e a permissão ads_read.
//  • Condição real da Página (vem da conexão Meta, /api/integrations/meta).
//  • "Sem API / Avançado": anúncios em Marketplace e grupos NÃO existem na
//    API oficial — são DECLARADOS + aviso de risco (browser automation);
//    o produto guarda apenas o parâmetro e não executa a coleta não-oficial
//    em silêncio (executor ainda ausente).
//
// Design: lilás + preto + branco. Nenhum segredo no front-end.

import AppNav from '@/components/AppNav';
import ApiBadge from '@/components/ApiBadge';
import RiskBanner from '@/components/RiskBanner';
import { useEffect, useState } from 'react';

export default function FacebookPage() {
  return (
    <>
      <AppNav />
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Facebook</h1>
            <p className="text-sm text-gray-500">
              Publicação e agendamento de posts de Página — 100% pela API oficial da Meta (usa a conexão
              do OAuth de /integrations).
            </p>
          </div>

          <div className="grid gap-6">
            <ConnectionStatusCard />
            <PublishCard />
            <AdsInsightsCard />
            <MarketplaceCard />
          </div>
        </div>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Condição real da Página                                             */
/* ------------------------------------------------------------------ */

function ConnectionStatusCard() {
  const [state, setState] = useState<{ loading: boolean; msg: string | null; hasPage: boolean }>({
    loading: true,
    msg: null,
    hasPage: false,
  });

  const load = () => {
    fetch('/api/integrations/meta')
      .then(async (r) => {
        if (r.status === 401) {
          setState({ loading: false, msg: 'Faça login para ver a conexão.', hasPage: false });
          return;
        }
        const d = await r.json().catch(() => ({}));
        const integ = Array.isArray(d.integrations) ? d.integrations[0] : null;
        setState({
          loading: false,
          msg: null,
          hasPage: Boolean(integ?.metaPageId && integ?.status !== 'DISCONNECTED'),
        });
      })
      .catch(() => setState({ loading: false, msg: 'Falha de rede ao carregar a conexão.', hasPage: false }));
  };

  useEffect(load, []);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-200">Conexão</h2>
        <ApiBadge layer="official" />
      </div>
      {state.loading ? (
        <p className="text-xs text-gray-500">Carregando…</p>
      ) : state.msg ? (
        <p className="text-xs text-amber-300">{state.msg}</p>
      ) : state.hasPage ? (
        <p className="text-xs text-green-300">Página do Facebook vinculada via OAuth. Publicação disponível.</p>
      ) : (
        <div className="text-xs text-gray-400">
          Nenhuma Página do Facebook conectada ainda.
          <div className="mt-2">
            <a
              href="/integrations"
              className="inline-block px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700"
            >
              Conectar via OAuth →
            </a>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Publicar / Agendar                                                  */
/* ------------------------------------------------------------------ */

function PublishCard() {
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [schedule, setSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const minLocal = () => {
    const d = new Date(Date.now() + 11 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  };

  const canSubmit = (message.trim().length > 0 || link.trim().length > 0) && (!schedule || scheduleAt.length > 0);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {};
      if (message.trim()) body.message = message.trim();
      if (link.trim()) body.link = link.trim();
      if (schedule && scheduleAt) body.scheduledAt = new Date(scheduleAt).toISOString();

      const r = await fetch('/api/facebook/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg({
          ok: true,
          text: schedule
            ? `Agendado para ${new Date(scheduleAt).toLocaleString('pt-BR')} (post ${d.postId ?? '—'}).`
            : `Publicado na Página com sucesso (post ${d.postId ?? '—'}).`,
        });
      } else if (r.status === 409 && d.error === 'no_fb_page') {
        setMsg({ ok: false, text: 'Nenhuma Página do Facebook vinculada. Conecte via OAuth em /integrations.' });
      } else if (r.status === 409) {
        setMsg({ ok: false, text: 'Meta não conectada neste tenant. Conecte em /integrations.' });
      } else if (r.status === 503) {
        setMsg({ ok: false, text: 'Meta não configurada no servidor (META_* / token ausentes) — item P0 do hpanel.' });
      } else if (r.status === 400) {
        setMsg({ ok: false, text: d.detail ? `Entrada inválida: ${d.detail}` : 'Entrada inválida.' });
      } else if (r.status === 401) {
        setMsg({ ok: false, text: 'Faça login para publicar.' });
      } else if (r.status === 502) {
        setMsg({ ok: false, text: d.detail ? `A API da Meta rejeitou: ${d.detail}` : 'A API da Meta não respondeu (502).' });
      } else {
        setMsg({ ok: false, text: `Falha ao publicar (HTTP ${r.status}).` });
      }
    } catch {
      setMsg({ ok: false, text: 'Falha de rede ao publicar.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-200">Publicar ou agendar na Página</h2>
        <ApiBadge layer="official" />
      </div>

      <div className="space-y-3">
        <label className="block text-xs text-gray-400">
          Texto do post <span className="text-gray-600">(ou um link)</span>
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Escreva aqui…" className={inputCls} />
        </label>

        <label className="block text-xs text-gray-400">
          Link (URL) <span className="text-gray-600">(opcional)</span>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className={inputCls} />
        </label>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} className="accent-purple-500" />
            Agendar
          </label>
          {schedule && (
            <input
              type="datetime-local"
              value={scheduleAt}
              min={minLocal()}
              onChange={(e) => setScheduleAt(e.target.value)}
              className={inputCls + '!mt-0 w-auto'}
            />
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => void submit()}
            disabled={busy || !canSubmit}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
          >
            {busy ? 'Enviando…' : schedule ? 'Agendar' : 'Publicar agora'}
          </button>
          <span className="text-xs text-gray-600">Agendamento: de 10 min a 75 dias.</span>
        </div>

        {msg && (
          <div
            className={`p-3 text-sm rounded-lg border ${
              msg.ok ? 'bg-green-400/10 border-green-400/25 text-green-300' : 'bg-amber-400/10 border-amber-400/25 text-amber-300'
            }`}
          >
            {msg.text}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* FASE 3 · slice 1 — Tracking de anúncios (Meta Ad Manager)          */
/* ------------------------------------------------------------------ */

const TIME_RANGES: Array<{ value: string; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last_7d', label: 'Últimos 7 dias' },
  { value: 'last_28d', label: 'Últimos 28 dias' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
  { value: 'last_quarter', label: 'Último trimestre' },
  { value: 'last_year', label: 'Último ano' },
];

function AdsInsightsCard() {
  const [timeRange, setTimeRange] = useState('last_7d');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setOut(null);
    try {
      const r = await fetch(`/api/meta/ads-insights?timeRange=${encodeURIComponent(timeRange)}`);
      const d = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(d.insights)) {
        if (d.insights.length === 0) {
          setOut(`Conta de anúncios ${d.adAccountId ?? '—'} não teve registros no período. Nada de gasto ou impressões neste intervalo.`);
        } else {
          setOut(
            d.insights
              .map((v: Record<string, unknown>) =>
                Object.entries(v)
                  .filter(([, x]) => x !== undefined && x !== null)
                  .map(([k, x]) => `${k}=${String(x)}`)
                  .join(' · '),
              )
              .join('\n'),
          );
        }
      } else if (r.status === 409 && d.error === 'not_connected') {
        setOut(`Não conectado. ${d.detail ?? ''}`);
      } else if (r.status === 409 && d.error === 'no_ad_account') {
        setOut(`ID da conta de anúncios ausente. ${d.detail ?? ''}`);
      } else if (r.status === 409) {
        setOut(`Credencial Meta incompleta: ${d.error ?? 'erro'}. ${d.detail ?? ''}`);
      } else if (r.status === 503) {
        setOut(d.detail ?? 'Memória/fila de integrações indisponível no servidor (503).');
      } else if (r.status === 502) {
        setOut(`A API da Meta rejeitou (502): ${d.detail ?? 'sem detalhe'}. Verifique a permissão ads_read e o ID da conta.`);
      } else if (r.status === 401) {
        setOut('Faça login para consultar os anúncios.');
      } else {
        setOut(`Falha (HTTP ${r.status}). ${d.detail ?? ''}`);
      }
    } catch {
      setOut('Falha de rede ao consultar os anúncios.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-200">Anúncios em tempo real (Ad Manager)</h2>
        <ApiBadge layer="official" />
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Métricas reais dos anúncios da sua conta de anúncios Meta (gasto, impressões, cliques, alcance)
        via Marketing API — o ID da conta fica em /integrations (Meta Ads); o token usa a conexão OAuth.
        Pré-requisito: permissão <code className="text-gray-300">ads_read</code> no app da Meta.
      </p>
      <div className="flex items-end gap-3">
        <label className="block text-xs text-gray-400">
          Período
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className={inputCls + ' !mt-1'}>
            {TIME_RANGES.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#0D0915]">
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => void load()}
          disabled={busy}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
        >
          {busy ? 'Consultando…' : 'Ver anúncios'}
        </button>
      </div>
      {out && <pre className="mt-3 text-xs text-gray-300 whitespace-pre-wrap bg-black/30 border border-white/10 rounded-lg p-2">{out}</pre>}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Sem API / Avançado — Marketplace e grupos (declarado)               */
/* ------------------------------------------------------------------ */

function MarketplaceCard() {
  const [maxPerHour, setMaxPerHour] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setMsg(null);
    try {
      const value: Record<string, unknown> = {};
      if (maxPerHour.trim()) value.maxPerHour = Number(maxPerHour.trim()) || undefined;
      const r = await fetch('/api/integrations/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'browser_automation', value }),
      });
      if (r.ok) setMsg('Parâmetro guardado. A execução (Marketplace/grupos via browser automation) é não-oficial e ainda não há executor no produto.');
      else if (r.status === 401) setMsg('Somente admin/owner configura.');
      else setMsg(`Falha ao guardar (HTTP ${r.status}).`);
    } catch {
      setMsg('Falha de rede ao guardar.');
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-200">Anúncios em Marketplace e grupos (delay configurável)</h2>
        <ApiBadge layer="sem_api" />
      </div>
      <RiskBanner>
        A Meta <strong>não expõe criação de anúncios no Marketplace nem em grupos pela API oficial</strong>. O
        método &quot;Sem API / Avançado&quot; (browser automation) viola os Termos de Uso e pode banir a
        Página/conta; também pode violar LGPD/GDPR. O produto declara o método e guarda apenas o parâmetro
        — a execução não-oficial é de responsabilidade do usuário e ainda não está implementada.
      </RiskBanner>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <label className="block text-xs text-gray-400">
          Limite de ações/hora
          <input value={maxPerHour} onChange={(e) => setMaxPerHour(e.target.value)} placeholder="ex.: 20" className={inputCls} />
        </label>
        <button onClick={() => void save()} className="self-end px-3 py-2 text-xs font-semibold rounded-lg border border-amber-400/30 text-amber-300 hover:bg-amber-400/10">
          Guardar parâmetro
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-gray-400">{msg}</p>}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Primitivas de layout                                                */
/* ------------------------------------------------------------------ */

const inputCls =
  'mt-1 w-full px-3 py-2 text-sm text-white bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 placeholder:text-gray-600';

function Card({ children }: { children: React.ReactNode }) {
  return <section className="p-4 sm:p-5 bg-[#0D0915] border border-white/10 rounded-2xl">{children}</section>;
}
