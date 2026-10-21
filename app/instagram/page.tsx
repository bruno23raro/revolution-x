'use client';

// Instagram — FASE 2 UI (canais principais).
//
//  • Publicação e agendamento de posts/reels pela Graph API oficial da Meta
//    (/api/instagram/publish): criar container → publicar/agendar.
//  • Condição real da conta IG (vem da conexão Meta, /api/integrations/meta).
//  • "Sem API / Avançado": automações (seguir/curtir/comentar em lote) são
//    DECLARADAS + aviso de risco; o produto guarda apenas o parâmetro e não
//    executa a coleta não-oficial em silêncio (executor ainda ausente).
//
// Design: lilás + preto + branco. Nenhum segredo no front-end.

import AppNav from '@/components/AppNav';
import ApiBadge from '@/components/ApiBadge';
import RiskBanner from '@/components/RiskBanner';
import { toLocalInputValue } from '@/lib/format-local-datetime';
import { useEffect, useState } from 'react';

export default function InstagramPage() {
  return (
    <>
      <AppNav />
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Instagram</h1>
            <p className="text-sm text-gray-400">
              Publicação e agendamento de posts, stories e reels — 100% pela API oficial da Meta (usa a conexão do
              OAuth de /integrations).
            </p>
          </div>

          <div className="grid gap-6">
            <ConnectionStatusCard />
            <PublishCard />
            <AutomationsCard />
          </div>
        </div>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Condição real da conta IG                                           */
/* ------------------------------------------------------------------ */

function ConnectionStatusCard() {
  const [state, setState] = useState<{ loading: boolean; msg: string | null; hasIig: boolean }>({
    loading: true,
    msg: null,
    hasIig: false,
  });

  const load = () => {
    fetch('/api/integrations/meta')
      .then(async (r) => {
        if (r.status === 401) {
          setState({ loading: false, msg: 'Faça login para ver a conexão.', hasIig: false });
          return;
        }
        const d = await r.json().catch(() => ({}));
        const integ = Array.isArray(d.integrations) ? d.integrations[0] : null;
        setState({
          loading: false,
          msg: null,
          hasIig: Boolean(integ?.instagramAccountId && integ?.status !== 'DISCONNECTED'),
        });
      })
      .catch(() => setState({ loading: false, msg: 'Falha de rede ao carregar a conexão.', hasIig: false }));
  };

  useEffect(load, []);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-200">Conexão</h2>
        <ApiBadge layer="official" />
      </div>
      {state.loading ? (
        <p className="text-xs text-gray-400">Carregando…</p>
      ) : state.msg ? (
        <p className="text-xs text-amber-300">{state.msg}</p>
      ) : state.hasIig ? (
        <p className="text-xs text-green-300">Conta de Instagram vinculada via OAuth. Publicação disponível.</p>
      ) : (
        <div className="text-xs text-gray-400">
          Nenhuma conta de Instagram conectada ainda.
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
  const [mediaType, setMediaType] = useState<'IMAGE' | 'REEL'>('IMAGE');
  const [imageSrc, setImageSrc] = useState('');
  const [videoSrc, setVideoSrc] = useState('');
  const [caption, setCaption] = useState('');
  const [schedule, setSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // MULTICONTAS — seletor de conta Meta (Instagram), só com 2+.
  const [metaList, setMetaList] = useState<Array<{ id: string; provider: string; metaPageId: string | null; instagramAccountId: string | null; displayName?: string | null }>>([]);
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

  // O resolver de publisher ancora em instagram|facebook|whatsapp.
  const igAccounts = metaList.filter((i) =>
    i.provider === 'instagram' || i.provider === 'facebook' || i.provider === 'whatsapp',
  );

  const minLocal = () => toLocalInputValue(new Date(Date.now() + 11 * 60 * 1000));

  const source = mediaType === 'REEL' ? videoSrc.trim() : imageSrc.trim();
  const canSubmit = source.length > 0 && (!schedule || scheduleAt.length > 0);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { mediaType, caption: caption.trim() || undefined };
      if (mediaType === 'REEL') body.videoUrl = videoSrc.trim() || imageSrc.trim();
      else body.imageUrl = imageSrc.trim();
      if (schedule && scheduleAt) body.scheduledAt = new Date(scheduleAt).toISOString();
      if (account) body.account = account; // MULTICONTAS — ancora a conta escolhida

      const r = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg({
          ok: true,
          text: schedule
            ? `Agendado para ${new Date(scheduleAt).toLocaleString('pt-BR')} (container ${d.containerId ?? '—'}).`
            : `Publicado com sucesso (post ${d.mediaId ?? '—'}).`,
        });
      } else if (r.status === 409 && d.error === 'no_ig_account') {
        setMsg({ ok: false, text: 'Nenhuma conta de Instagram vinculada. Conecte via OAuth em /integrations.' });
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
        <h2 className="text-sm font-bold text-gray-200">Publicar ou agendar</h2>
        <ApiBadge layer="official" />
      </div>

      <div className="space-y-3">
        {igAccounts.length > 1 && (
          <label className="block text-xs text-gray-400">
            Conta Instagram <span className="text-gray-400">(publica nesta conta)</span>
            <select value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls}>
              <option value="" className="bg-[#0D0915]">Padrão (mais recente)</option>
              {igAccounts.map((i) => (
                <option key={i.id} value={i.id} className="bg-[#0D0915]">
                  {i.displayName || i.instagramAccountId || i.metaPageId || i.provider}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-gray-400">
            Tipo
            <select value={mediaType} onChange={(e) => setMediaType(e.target.value as 'IMAGE' | 'REEL')} className={inputCls}>
              <option value="IMAGE" className="bg-[#0D0915]">Postagem (foto)</option>
              <option value="REEL" className="bg-[#0D0915]">Reel / vídeo</option>
            </select>
          </label>
          <label className="block text-xs text-gray-400">
            {mediaType === 'REEL' ? 'URL do vídeo' : 'URL da imagem'}
            <input
              value={mediaType === 'REEL' ? videoSrc : imageSrc}
              onChange={(e) => (mediaType === 'REEL' ? setVideoSrc(e.target.value) : setImageSrc(e.target.value))}
              placeholder={mediaType === 'REEL' ? 'https://…/video.mp4' : 'https://…/foto.jpg'}
              className={inputCls}
            />
          </label>
        </div>

        <label className="block text-xs text-gray-400">
          Legenda <span className="text-gray-400">(opcional)</span>
          <textarea rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="…" className={inputCls} />
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
            {busy ? 'Enviando…' : schedule ? 'Agendar' : 'Publicar agora'}
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
/* Sem API / Avançado — automações (declarado)                         */
/* ------------------------------------------------------------------ */

function AutomationsCard() {
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
        body: JSON.stringify({ provider: 'scraper_instagram', value }),
      });
      if (r.ok) setMsg('Parâmetro guardado. A execução (scraping/automação) é não-oficial e ainda não há executor no produto.');
      else if (r.status === 401) setMsg('Somente admin/owner configura.');
      else setMsg(`Falha ao guardar (HTTP ${r.status}).`);
    } catch {
      setMsg('Falha de rede ao guardar.');
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-200">Automações (seguir / curtir / comentar)</h2>
        <ApiBadge layer="sem_api" />
      </div>
      <RiskBanner>
        Seguir, curtir e comentar em lote não são expostos pela API oficial do Instagram. O método
        &quot;Sem API / Avançado&quot; (scraping, QR Code, automação de navegador) viola os Termos de Uso e
        pode banir a conta; também pode violar LGPD/GDPR. O produto declara o método e guarda apenas o
        parâmetro — a execução não-oficial é de responsabilidade do usuário e ainda não está implementada.
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
