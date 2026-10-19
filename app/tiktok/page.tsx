'use client';

// TikTok — FASE 2 UI (canais principais).
//
//  • Publicação (agora) e agendamento de vídeos pela Content Posting API
//    OFICIAL do TikTok (/api/tiktok/publish). A API não tem horário de
//    publicação, então o agendamento persiste a intenção e o EXECUTOR fica no
//    agendador (/api/tiktok/tick — FASE 4), que publica via API oficial e
//    marca o resultado na própria fila.
//  • Tracking: estado (`/api/tiktok/status`) e métricas
//    (`/api/tiktok/analytics`) dos vídeos publicados.
//  • FASE 3: anúncios em tempo real via Business API (`/api/tiktok/ads-insights`)
//    — Advertiser ID + token BAP em /integrations (TikTok Ads).
//  • "Sem API / Avançado": scraping de seguidores/vídeos NÃO existe na API
//    oficial — é DECLARADO + aviso de risco (provider `scraper_tiktok`); o
//    produto guarda apenas o parâmetro e não executa a coleta não-oficial em
//    silêncio (executor ainda ausente).
//
// Design: lilás + preto + branco. Nenhum segredo no front-end.

import AppNav from '@/components/AppNav';
import ApiBadge from '@/components/ApiBadge';
import RiskBanner from '@/components/RiskBanner';
import { useEffect, useState } from 'react';

const PRIVACY_LEVELS: Array<{ value: string; label: string }> = [
  { value: 'PUBLIC_TO_EVERYONE', label: 'Público' },
  { value: 'MUTUAL_FOLLOW_FRIENDS', label: 'Seguidores mútuos' },
  { value: 'FOLLOWER_OF_CREATORS', label: 'Seguidores do criador' },
  { value: 'SELF_ONLY', label: 'Só eu' },
];

export default function TikTokPage() {
  return (
    <>
      <AppNav />
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">TikTok</h1>
            <p className="text-sm text-gray-500">
              Publicação e tracking de vídeos — 100% pela API oficial do TikTok. O agendamento persiste a
              intenção (a API oficial não publica em hora marcada).
            </p>
          </div>

          <div className="grid gap-6">
            <ConnectionStatusCard />
            <PublishCard />
            <ScheduledCard />
            <TrackingCard />
            <AdsInsightsCard />
            <ScrapingCard />
          </div>
        </div>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Condição real do provedor TikTok                                    */
/* ------------------------------------------------------------------ */

function ConnectionStatusCard() {
  const [state, setState] = useState<{ loading: boolean; msg: string | null; configured: boolean }>({
    loading: true,
    msg: null,
    configured: false,
  });

  const load = () => {
    fetch('/api/integrations/config')
      .then(async (r) => {
        if (r.status === 401) {
          setState({ loading: false, msg: 'Faça login para ver a conexão.', configured: false });
          return;
        }
        if (r.status === 503) {
          setState({ loading: false, msg: 'Memória de integrações indisponível (503) — tabela não migrada aqui.', configured: false });
          return;
        }
        const d = await r.json().catch(() => ({}));
        const hit = Array.isArray(d.providers) ? d.providers.find((p: { id: string }) => p.id === 'tiktok') : null;
        setState({ loading: false, msg: null, configured: Boolean(hit?.configured) });
      })
      .catch(() => setState({ loading: false, msg: 'Falha de rede ao carregar a conexão.', configured: false }));
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
      ) : state.configured ? (
        <p className="text-xs text-green-300">
          Provedor TikTok configurado (clientKey/secret). Para publicar, um Access Token de usuário é
          necessário — confira em /integrations.
        </p>
      ) : (
        <div className="text-xs text-gray-400">
          Provedor TikTok ainda não conectado.
          <div className="mt-2">
            <a
              href="/integrations"
              className="inline-block px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700"
            >
              Conectar →
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
  const [videoUrl, setVideoUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState('PUBLIC_TO_EVERYONE');
  const [disableComment, setDisableComment] = useState(false);
  const [aigc, setAigc] = useState(false);
  const [schedule, setSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const minLocal = () => {
    const d = new Date(Date.now() + 2 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  };

  const canSubmit = videoUrl.trim().length > 0 && (!schedule || scheduleAt.length > 0);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { videoUrl: videoUrl.trim(), privacyLevel: privacy };
      if (caption.trim()) body.caption = caption.trim();
      body.disableComment = disableComment;
      body.aigc = aigc;
      if (schedule && scheduleAt) body.scheduledAt = new Date(scheduleAt).toISOString();

      const r = await fetch('/api/tiktok/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg({
          ok: true,
          text: schedule
            ? `Agendado para ${new Date(scheduleAt).toLocaleString('pt-BR')} (intenção ${d.intentId ?? '—'}). ${d.note ?? ''}`
            : `Vídeo enviado para publicação (publish_id ${d.publishId ?? '—'}).`,
        });
      } else if (r.status === 409 && d.error === 'not_connected') {
        setMsg({ ok: false, text: 'Provedor TikTok não conectado. Preencha em /integrations.' });
      } else if (r.status === 409 && d.error === 'no_token') {
        setMsg({ ok: false, text: 'Access Token do TikTok ausente. Conecte em /integrations.' });
      } else if (r.status === 409) {
        setMsg({ ok: false, text: d.detail ?? 'TikTok não conectado neste tenant.' });
      } else if (r.status === 503) {
        setMsg({ ok: false, text: 'Memória/fila de integrações indisponível no servidor (503).' });
      } else if (r.status === 400) {
        setMsg({ ok: false, text: d.detail ? `Entrada inválida: ${d.detail}` : 'Entrada inválida.' });
      } else if (r.status === 401) {
        setMsg({ ok: false, text: 'Faça login para publicar.' });
      } else if (r.status === 502) {
        setMsg({ ok: false, text: d.detail ? `A API do TikTok rejeitou: ${d.detail}` : 'A API do TikTok não respondeu (502).' });
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
        <h2 className="text-sm font-bold text-gray-200">Publicar ou agendar vídeo</h2>
        <ApiBadge layer="official" />
      </div>

      <div className="space-y-3">
        <label className="block text-xs text-gray-400">
          URL pública do vídeo <span className="text-gray-600">(o TikTok puxa por URL)</span>
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://cdn.seusite.com/video.mp4" className={inputCls} />
        </label>

        <label className="block text-xs text-gray-400">
          Legenda (opcional)
          <textarea rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Fale sobre o vídeo…" className={inputCls} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-gray-400">
            Privacidade
            <select value={privacy} onChange={(e) => setPrivacy(e.target.value)} className={inputCls + ' !mt-1'}>
              {PRIVACY_LEVELS.map((o) => (
                <option key={o.value} value={o.value} className="bg-[#0D0915]">
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-4 pb-1">
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={disableComment} onChange={(e) => setDisableComment(e.target.checked)} className="accent-purple-500" />
              Bloq. comentários
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={aigc} onChange={(e) => setAigc(e.target.checked)} className="accent-purple-500" />
              IA
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} className="accent-purple-500" />
            Agendar
          </label>
          {schedule && (
            <input type="datetime-local" value={scheduleAt} min={minLocal()} onChange={(e) => setScheduleAt(e.target.value)} className={inputCls + '!mt-0 w-auto'} />
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
          <span className="text-xs text-gray-600">
            {schedule
              ? 'A API oficial não publica em hora marcada — a intenção é guardada e o executor processa no card "Agendados".'
              : 'Publicação imediata via PULL_FROM_URL.'}
          </span>
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
/* FASE 4 · slice 1 — Agendados (executor da fila)                     */
/* ------------------------------------------------------------------ */

interface PendingView {
  id: string;
  scheduledAt: string;
  status: 'pending' | 'published' | 'failed';
  publishId?: string;
  videoUrl?: string;
  caption?: string;
}

function ScheduledCard() {
  const [pending, setPending] = useState<PendingView[] | null>(null);
  const [queueState, setQueueState] = useState<'loading' | 'ok' | 'unavailable' | 'unauth' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [tickOut, setTickOut] = useState<string | null>(null);

  const load = () => {
    setQueueState('loading');
    setTickOut(null);
    fetch('/api/tiktok/tick')
      .then(async (r) => {
        if (r.status === 401) {
          setQueueState('unauth');
          setPending([]);
          return;
        }
        if (r.status === 503) {
          setQueueState('unavailable');
          setPending([]);
          return;
        }
        const d = await r.json().catch(() => ({}));
        if (r.ok) {
          setPending(Array.isArray(d.pending) ? d.pending : []);
          setQueueState('ok');
        } else {
          setQueueState('error');
          setPending([]);
        }
      })
      .catch(() => {
        setQueueState('error');
        setPending([]);
      });
  };

  const runTick = async () => {
    setBusy(true);
    setTickOut(null);
    try {
      const r = await fetch('/api/tiktok/tick', { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) {
        setTickOut('Faça login para processar os agendados.');
      } else if (r.status === 503) {
        setTickOut(`Fila indisponível no servidor (503)${d.detail ? ` — ${d.detail}` : ''}.`);
      } else if (r.ok && d.ok) {
        setTickOut(
          `Tick concluído: ${d.due ?? 0} vencido(s), ${d.published ?? 0} publicado(s), ${d.failed ?? 0} falha(s).`,
        );
      } else if (r.ok && d.error === 'queue_unavailable') {
        setTickOut(`Fila indisponível${d.detail ? ` — ${d.detail}` : ''}.`);
      } else if (r.ok) {
        const why = Array.isArray(d.reasons) && d.reasons.length > 0 ? ` Motivos: ${d.reasons.join('; ')}.` : '';
        setTickOut(
          `Tick concluído com falhas: ${d.due ?? 0} vencido(s), ${d.published ?? 0} publicado(s), ${d.failed ?? 0} falha(s).${why}`,
        );
      } else {
        setTickOut(`Falha ao processar (HTTP ${r.status}).`);
      }
      load(); // recarrega a fila com o estado novo
    } catch {
      setTickOut('Falha de rede ao processar os agendados.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(load, []);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-200">Agendados (executor da fila)</h2>
        <ApiBadge layer="official" />
      </div>

      <p className="text-xs text-gray-400 mb-3">
        Como a API oficial não publica em hora marcada, o agendamento guarda a <em>intenção</em>. Este card é o
        executor: processa os itens vencidos, publica pela Content Posting API e marca o resultado na própria fila
        (idempotente — cada item é processado uma vez).
      </p>

      {queueState === 'loading' && <p className="text-xs text-gray-500">Carregando fila…</p>}
      {queueState === 'unauth' && <p className="text-xs text-amber-300">Faça login para ver os agendados.</p>}
      {queueState === 'unavailable' && (
        <p className="text-xs text-amber-300">Memória/fila de integrações indisponível no servidor (503).</p>
      )}
      {queueState === 'error' && <p className="text-xs text-amber-300">Falha ao carregar a fila.</p>}
      {queueState === 'ok' && pending && pending.length === 0 && (
        <p className="text-xs text-gray-400">Nenhum agendamento pendente.</p>
      )}
      {queueState === 'ok' && pending && pending.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {pending.map((p) => (
            <li key={p.id} className="text-xs text-gray-300 flex flex-wrap items-center gap-x-2">
              <span
                className={
                  p.status === 'published'
                    ? 'text-green-300'
                    : p.status === 'failed'
                      ? 'text-red-300'
                      : 'text-purple-300'
                }
              >
                [{p.status}]
              </span>
              <span className="text-gray-500">{new Date(p.scheduledAt).toLocaleString('pt-BR')}</span>
              <span className="text-gray-600 truncate" title={p.videoUrl}>
                {p.videoUrl}
              </span>
              {p.publishId && <span className="text-gray-600">pub {p.publishId}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => void runTick()}
          disabled={busy || queueState !== 'ok'}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
        >
          {busy ? 'Processando…' : 'Processar agendados'}
        </button>
        <button
          onClick={load}
          disabled={queueState === 'loading'}
          className="px-3 py-2 text-xs font-semibold rounded-lg border border-white/15 text-gray-300 hover:bg-white/5 disabled:opacity-40"
        >
          Recarregar
        </button>
      </div>

      {tickOut && (
        <div
          className={`mt-3 p-3 text-xs rounded-lg border ${
            tickOut.includes('falha') || tickOut.includes('Falha') || tickOut.includes('indisponível')
              ? 'bg-amber-400/10 border-amber-400/25 text-amber-300'
              : 'bg-green-400/10 border-green-400/25 text-green-300'
          }`}
        >
          {tickOut}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tracking (estado + métricas)                                        */
/* ------------------------------------------------------------------ */

function TrackingCard() {
  const [statusId, setStatusId] = useState('');
  const [analyticsIds, setAnalyticsIds] = useState('');
  const [busyS, setBusyS] = useState(false);
  const [busyA, setBusyA] = useState(false);
  const [statusOut, setStatusOut] = useState<string | null>(null);
  const [analyticsOut, setAnalyticsOut] = useState<string | null>(null);

  const checkStatus = async () => {
    if (!statusId.trim()) return;
    setBusyS(true);
    setStatusOut(null);
    try {
      const r = await fetch(`/api/tiktok/status?publishId=${encodeURIComponent(statusId.trim())}`);
      const d = await r.json().catch(() => ({}));
      setStatusOut(
        r.ok
          ? `Estado: ${d.status ?? 'desconhecido'} (publish_id ${statusId.trim()})`
          : d.detail ? `Falha: ${d.detail}` : `Falha (HTTP ${r.status})`,
      );
    } catch {
      setStatusOut('Falha de rede ao consultar.');
    } finally {
      setBusyS(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!analyticsIds.trim()) return;
    setBusyA(true);
    setAnalyticsOut(null);
    try {
      const ids = encodeURIComponent(analyticsIds.trim());
      const r = await fetch(`/api/tiktok/analytics?publishIds=${ids}`);
      const d = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(d.items) && d.items.length > 0) {
        setAnalyticsOut(
          d.items
            .map(
              (v: {
                publishId?: string;
                status?: string;
                playCount?: number;
                likeCount?: number;
                shareCount?: number;
                commentCount?: number;
              }) =>
                `${v.publishId} [${v.status ?? '?'}]: ${v.playCount ?? 0} plays, ${v.likeCount ?? 0} curtidas, ${v.shareCount ?? 0} compartilh., ${v.commentCount ?? 0} comentários`,
            )
            .join('\n'),
        );
      } else {
        setAnalyticsOut(d.detail ? `Falha: ${d.detail}` : `Nenhuma métrica (HTTP ${r.status}).`);
      }
    } catch {
      setAnalyticsOut('Falha de rede ao consultar métricas.');
    } finally {
      setBusyA(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-200">Tracking de vídeos</h2>
        <ApiBadge layer="official" />
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-400">Estado de um vídeo (publish_id)</label>
          <div className="flex gap-2 mt-1">
            <input value={statusId} onChange={(e) => setStatusId(e.target.value)} placeholder="734123…" className={inputCls + '!mt-0'} />
            <button onClick={() => void checkStatus()} disabled={busyS || !statusId.trim()} className="shrink-0 px-3 py-2 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40">
              {busyS ? '…' : 'Estado'}
            </button>
          </div>
          {statusOut && <p className="mt-2 text-xs text-gray-300 whitespace-pre-wrap">{statusOut}</p>}
        </div>

        <div>
          <label className="block text-xs text-gray-400">Métricas (até 5 publish_ids, separados por vírgula)</label>
          <div className="flex gap-2 mt-1">
            <input value={analyticsIds} onChange={(e) => setAnalyticsIds(e.target.value)} placeholder="734123, 734124" className={inputCls + '!mt-0'} />
            <button onClick={() => void fetchAnalytics()} disabled={busyA || !analyticsIds.trim()} className="shrink-0 px-3 py-2 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40">
              {busyA ? '…' : 'Métricas'}
            </button>
          </div>
          {analyticsOut && (
            <pre className="mt-2 text-xs text-gray-300 whitespace-pre-wrap bg-black/30 border border-white/10 rounded-lg p-2">{analyticsOut}</pre>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* FASE 3 · slice 1 — Anúncios em tempo real (TikTok Business API)    */
/* ------------------------------------------------------------------ */

const AD_ENTITIES: Array<{ value: string; label: string }> = [
  { value: 'AD_ACCOUNT', label: 'Conta (total)' },
  { value: 'CAMPAIGN', label: 'Campanhas' },
  { value: 'AD_GROUP', label: 'Grupos de anúncios' },
  { value: 'AD', label: 'Anúncios' },
  { value: 'CREATIVE', label: 'Criativos' },
];

function AdsInsightsCard() {
  const [date, setDate] = useState('');
  const [entity, setEntity] = useState('AD_GROUP');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setOut(null);
    const qs = new URLSearchParams();
    if (date) qs.set('date', date);
    if (entity) qs.set('entity', entity);
    try {
      const r = await fetch(`/api/tiktok/ads-insights?${qs.toString()}`);
      const d = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(d.rows)) {
        if (d.rows.length === 0) {
          setOut(`Advertiser ${d.advertiserId ?? '—'} sem registros no dia ${d.date ?? '?'} (nível ${d.entity ?? '?'}) — sem gasto ou impressões.`);
        } else {
          setOut(
            d.rows
              .map((row: Record<string, unknown>) =>
                Object.entries(row)
                  .filter(([, x]) => x !== undefined && x !== null)
                  .map(([k, x]) => `${k}=${String(x)}`)
                  .join(' · '),
              )
              .join('\n'),
          );
        }
      } else if (r.status === 409 && d.error === 'not_connected') {
        setOut(`Não conectado. ${d.detail ?? ''}`);
      } else if (r.status === 409 && (d.error === 'no_token' || d.error === 'no_advertiser')) {
        setOut(`Credencial incompleta (${d.error}). ${d.detail ?? ''}`);
      } else if (r.status === 409) {
        setOut(d.detail ?? 'TikTok Ads não conectado neste tenant.');
      } else if (r.status === 503) {
        setOut(d.detail ?? 'Memória/fila de integrações indisponível no servidor (503).');
      } else if (r.status === 502) {
        setOut(`A API do TikTok rejeitou (502): ${d.detail ?? 'sem detalhe'}. Confira o token BAP e o Advertiser ID.`);
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
        <h2 className="text-sm font-bold text-gray-200">Anúncios em tempo real (TikTok Ads)</h2>
        <ApiBadge layer="official" />
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Relatórios do Gerenciador de Anúncios do TikTok (Business API) — Advertiser ID e Access Token de
        Business ficam em /integrations (TikTok Ads). O relatório cobre 1 dia por consulta; deixe vazio
        para ontem.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-gray-400">
          Data (YYYY-MM-DD, opcional)
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-xs text-gray-400">
          Nível
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className={inputCls + ' !mt-1'}>
            {AD_ENTITIES.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#0D0915]">
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3">
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
/* Sem API / Avançado — scraping (declarado)                           */
/* ------------------------------------------------------------------ */

function ScrapingCard() {
  const [proxy, setProxy] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setMsg(null);
    try {
      const value: Record<string, unknown> = {};
      if (proxy.trim()) value.proxy = proxy.trim();
      const r = await fetch('/api/integrations/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'scraper_tiktok', value }),
      });
      if (r.ok) setMsg('Parâmetro guardado. A coleta por scraping é não-oficial e ainda não há executor no produto.');
      else if (r.status === 401) setMsg('Somente admin/owner configura.');
      else setMsg(`Falha ao guardar (HTTP ${r.status}).`);
    } catch {
      setMsg('Falha de rede ao guardar.');
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-200">Coleta de seguidores/vídeos (scraping)</h2>
        <ApiBadge layer="sem_api" />
      </div>
      <RiskBanner>
        O TikTok <strong>não expõe coleta de seguidores/vídeos pela API oficial</strong>. O método
        &quot;Sem API / Avançado&quot; (scraping) viola os Termos de Uso, pode bloquear IP/conta e violar
        LGPD/GDPR. O produto declara o método e guarda apenas o parâmetro — a execução não-oficial é de
        responsabilidade do usuário e ainda não está implementada.
      </RiskBanner>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <label className="block text-xs text-gray-400">
          Proxy (opcional)
          <input value={proxy} onChange={(e) => setProxy(e.target.value)} placeholder="http://…" className={inputCls} />
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
