'use client';

// Facebook â€” FASE 2 UI (canais principais).
//
//  â€¢ PublicaÃ§Ã£o e agendamento de posts de PÃ¡gina pela Graph API oficial da
//    Meta (/api/facebook/publish): 10 min a 75 dias.
//  â€¢ FASE 3: tracking de anÃºncios em tempo real via Marketing API
//    (Ad Manager, /api/meta/ads-insights) â€” exige o ID da conta de
//    anÃºncios em /integrations (Meta Ads) e a permissÃ£o ads_read.
//  â€¢ CondiÃ§Ã£o real da PÃ¡gina (vem da conexÃ£o Meta, /api/integrations/meta).
//  â€¢ "Sem API / AvanÃ§ado": anÃºncios em Marketplace e grupos NÃƒO existem na
//    API oficial â€” sÃ£o DECLARADOS + aviso de risco (browser automation);
//    o produto guarda apenas o parÃ¢metro e nÃ£o executa a coleta nÃ£o-oficial
//    em silÃªncio (executor ainda ausente).
//
// Design: lilÃ¡s + preto + branco. Nenhum segredo no front-end.

import AppShell from '@/components/AppShell';
import ApiBadge from '@/components/ApiBadge';
import RiskBanner from '@/components/RiskBanner';
import { toLocalInputValue } from '@/lib/format-local-datetime';
import { useEffect, useState } from 'react';

export default function FacebookPage() {
  return (
    <AppShell>
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Facebook</h1>
            <p className="text-sm text-gray-400">
              PublicaÃ§Ã£o e agendamento de posts de PÃ¡gina â€” 100% pela API oficial da Meta (usa a conexÃ£o
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
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* CondiÃ§Ã£o real da PÃ¡gina                                             */
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
          setState({ loading: false, msg: 'FaÃ§a login para ver a conexÃ£o.', hasPage: false });
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
      .catch(() => setState({ loading: false, msg: 'Falha de rede ao carregar a conexÃ£o.', hasPage: false }));
  };

  useEffect(load, []);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-200">ConexÃ£o</h2>
        <ApiBadge layer="official" />
      </div>
      {state.loading ? (
        <p className="text-xs text-gray-400">Carregandoâ€¦</p>
      ) : state.msg ? (
        <p className="text-xs text-amber-300">{state.msg}</p>
      ) : state.hasPage ? (
        <p className="text-xs text-green-300">PÃ¡gina do Facebook vinculada via OAuth. PublicaÃ§Ã£o disponÃ­vel.</p>
      ) : (
        <div className="text-xs text-gray-400">
          Nenhuma PÃ¡gina do Facebook conectada ainda.
          <div className="mt-2">
            <a
              href="/integrations"
              className="inline-block px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700"
            >
              Conectar via OAuth â†’
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
  // MULTICONTAS â€” seletor de conta Meta (PÃ¡ginas), sÃ³ com 2+.
  const [metaList, setMetaList] = useState<Array<{ id: string; provider: string; metaPageId: string | null; displayName?: string | null }>>([]);
  const [account, setAccount] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/integrations/meta')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.integrations)) setMetaList(d.integrations);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // O resolver de PÃ¡gina ancora em provider facebook|whatsapp.
  const fbAccounts = metaList.filter((i) => i.provider === 'facebook' || i.provider === 'whatsapp');

  const minLocal = () => toLocalInputValue(new Date(Date.now() + 11 * 60 * 1000));

  const canSubmit = (message.trim().length > 0 || link.trim().length > 0) && (!schedule || scheduleAt.length > 0);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {};
      if (message.trim()) body.message = message.trim();
      if (link.trim()) body.link = link.trim();
      if (schedule && scheduleAt) body.scheduledAt = new Date(scheduleAt).toISOString();
      if (account) body.account = account; // MULTICONTAS â€” ancora a PÃ¡gina escolhida

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
            ? `Agendado para ${new Date(scheduleAt).toLocaleString('pt-BR')} (post ${d.postId ?? 'â€”'}).`
            : `Publicado na PÃ¡gina com sucesso (post ${d.postId ?? 'â€”'}).`,
        });
      } else if (r.status === 409 && d.error === 'no_fb_page') {
        setMsg({ ok: false, text: 'Nenhuma PÃ¡gina do Facebook vinculada. Conecte via OAuth em /integrations.' });
      } else if (r.status === 409) {
        setMsg({ ok: false, text: 'Meta nÃ£o conectada neste tenant. Conecte em /integrations.' });
      } else if (r.status === 503) {
        setMsg({ ok: false, text: 'Meta nÃ£o configurada no servidor (META_* / token ausentes) â€” item P0 do hpanel.' });
      } else if (r.status === 400) {
        setMsg({ ok: false, text: d.detail ? `Entrada invÃ¡lida: ${d.detail}` : 'Entrada invÃ¡lida.' });
      } else if (r.status === 401) {
        setMsg({ ok: false, text: 'FaÃ§a login para publicar.' });
      } else if (r.status === 502) {
        setMsg({ ok: false, text: d.detail ? `A API da Meta rejeitou: ${d.detail}` : 'A API da Meta nÃ£o respondeu (502).' });
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
        <h2 className="text-sm font-bold text-gray-200">Publicar ou agendar na PÃ¡gina</h2>
        <ApiBadge layer="official" />
      </div>

      <div className="space-y-3">
        <label className="block text-xs text-gray-400">
          Texto do post <span className="text-gray-400">(ou um link)</span>
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Escreva aquiâ€¦" className={inputCls} />
        </label>

        {fbAccounts.length > 1 && (
          <label className="block text-xs text-gray-400">
            PÃ¡gina <span className="text-gray-400">(publica nesta PÃ¡gina)</span>
            <select value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls + ' !mt-1'}>
              <option value="" className="bg-[#0D0915]">PadrÃ£o (mais recente)</option>
              {fbAccounts.map((i) => (
                <option key={i.id} value={i.id} className="bg-[#0D0915]">
                  {i.displayName || i.metaPageId || i.provider}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-xs text-gray-400">
          Link (URL) <span className="text-gray-400">(opcional)</span>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://â€¦" className={inputCls} />
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
              aria-label="Data e hora de agendamento"
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
            {busy ? 'Enviandoâ€¦' : schedule ? 'Agendar' : 'Publicar agora'}
          </button>
          <span className="text-xs text-gray-400">Agendamento: de 10 min a 75 dias.</span>
        </div>

        {msg && (
          <div
            role="status"
            aria-live="polite"
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
/* FASE 3 Â· slice 1 â€” Tracking de anÃºncios (Meta Ad Manager)          */
/* ------------------------------------------------------------------ */

const TIME_RANGES: Array<{ value: string; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last_7d', label: 'Ãšltimos 7 dias' },
  { value: 'last_28d', label: 'Ãšltimos 28 dias' },
  { value: 'this_month', label: 'Este mÃªs' },
  { value: 'last_month', label: 'MÃªs passado' },
  { value: 'last_quarter', label: 'Ãšltimo trimestre' },
  { value: 'last_year', label: 'Ãšltimo ano' },
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
          setOut(`Conta de anÃºncios ${d.adAccountId ?? 'â€”'} nÃ£o teve registros no perÃ­odo. Nada de gasto ou impressÃµes neste intervalo.`);
        } else {
          setOut(
            d.insights
              .map((v: Record<string, unknown>) =>
                Object.entries(v)
                  .filter(([, x]) => x !== undefined && x !== null)
                  .map(([k, x]) => `${k}=${String(x)}`)
                  .join(' Â· '),
              )
              .join('\n'),
          );
        }
      } else if (r.status === 409 && d.error === 'not_connected') {
        setOut(`NÃ£o conectado. ${d.detail ?? ''}`);
      } else if (r.status === 409 && d.error === 'no_ad_account') {
        setOut(`ID da conta de anÃºncios ausente. ${d.detail ?? ''}`);
      } else if (r.status === 409) {
        setOut(`Credencial Meta incompleta: ${d.error ?? 'erro'}. ${d.detail ?? ''}`);
      } else if (r.status === 503) {
        setOut(d.detail ?? 'MemÃ³ria/fila de integraÃ§Ãµes indisponÃ­vel no servidor (503).');
      } else if (r.status === 502) {
        setOut(`A API da Meta rejeitou (502): ${d.detail ?? 'sem detalhe'}. Verifique a permissÃ£o ads_read e o ID da conta.`);
      } else if (r.status === 401) {
        setOut('FaÃ§a login para consultar os anÃºncios.');
      } else {
        setOut(`Falha (HTTP ${r.status}). ${d.detail ?? ''}`);
      }
    } catch {
      setOut('Falha de rede ao consultar os anÃºncios.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-200">AnÃºncios em tempo real (Ad Manager)</h2>
        <ApiBadge layer="official" />
      </div>
      <p className="text-xs text-gray-400 mb-3">
        MÃ©tricas reais dos anÃºncios da sua conta de anÃºncios Meta (gasto, impressÃµes, cliques, alcance)
        via Marketing API â€” o ID da conta fica em /integrations (Meta Ads); o token usa a conexÃ£o OAuth.
        PrÃ©-requisito: permissÃ£o <code className="text-gray-300">ads_read</code> no app da Meta.
      </p>
      <div className="flex items-end gap-3">
        <label className="block text-xs text-gray-400">
          PerÃ­odo
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
          {busy ? 'Consultandoâ€¦' : 'Ver anÃºncios'}
        </button>
      </div>
      {out && <pre className="mt-3 text-xs text-gray-300 whitespace-pre-wrap bg-black/30 border border-white/10 rounded-lg p-2">{out}</pre>}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Sem API / AvanÃ§ado â€” Marketplace e grupos (declarado)               */
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
      if (r.ok) setMsg('ParÃ¢metro guardado. A execuÃ§Ã£o (Marketplace/grupos via browser automation) Ã© nÃ£o-oficial e ainda nÃ£o hÃ¡ executor no produto.');
      else if (r.status === 401) setMsg('Somente admin/owner configura.');
      else setMsg(`Falha ao guardar (HTTP ${r.status}).`);
    } catch {
      setMsg('Falha de rede ao guardar.');
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-200">AnÃºncios em Marketplace e grupos (delay configurÃ¡vel)</h2>
        <ApiBadge layer="sem_api" />
      </div>
      <RiskBanner>
        A Meta <strong>nÃ£o expÃµe criaÃ§Ã£o de anÃºncios no Marketplace nem em grupos pela API oficial</strong>. O
        mÃ©todo &quot;Sem API / AvanÃ§ado&quot; (browser automation) viola os Termos de Uso e pode banir a
        PÃ¡gina/conta; tambÃ©m pode violar LGPD/GDPR. O produto declara o mÃ©todo e guarda apenas o parÃ¢metro
        â€” a execuÃ§Ã£o nÃ£o-oficial Ã© de responsabilidade do usuÃ¡rio e ainda nÃ£o estÃ¡ implementada.
      </RiskBanner>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <label className="block text-xs text-gray-400">
          Limite de aÃ§Ãµes/hora
          <input value={maxPerHour} onChange={(e) => setMaxPerHour(e.target.value)} placeholder="ex.: 20" className={inputCls} />
        </label>
        <button onClick={() => void save()} className="self-end px-3 py-2 text-xs font-semibold rounded-lg border border-amber-400/30 text-amber-300 hover:bg-amber-400/10">
          Guardar parÃ¢metro
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
