'use client';

// IntegraÃ§Ãµes â€” Hub de integraÃ§Ãµes (FASE 1 UI).
//
//  â€¢ CondiÃ§Ã£o real da integraÃ§Ã£o Meta (paginas/Instagram/WhatsApp) via /api/integrations/meta.
//  â€¢ Provedores separados visualmente em "API Oficial" (roxo) e "Sem API / AvanÃ§ado"
//    (Ã¢mbar + aviso de risco). Cada um tem fluxo "Integrar" (form guiado) e estado de saÃºde.
//  â€¢ Token refresh + health check (sÃ³ admin). Nenhum segredo aparece no front-end.
//
// O front sÃ³ faz fetch; os segredos vivem no banco (AgentMemory, RLS) â€” padrÃ£o ai-config.

import AppShell from '@/components/AppShell';
import ApiBadge from '@/components/ApiBadge';
import RiskBanner from '@/components/RiskBanner';
import HealthPill from '@/components/HealthPill';
import { providersByLayer, OUTBOUND_PROVIDER_IDS, type ProviderDef, type ProbeStatus } from '@/integrations/providers';
import { useCallback, useEffect, useState } from 'react';

interface MetaIntegration {
  id: string;
  provider: string;
  metaPageId: string | null;
  instagramAccountId: string | null;
  whatsappBusinessAccountId: string | null;
  phoneNumberId: string | null;
  displayName?: string | null;
  tokenExpiresAt: string | null;
  status: string | null;
  lastError: string | null;
}

interface ConfigProvider {
  id: string;
  configured: boolean;
  updatedAt: string | null;
}

const OFFICIAL = providersByLayer('official');
const SEM_API = providersByLayer('sem_api');

export default function IntegrationsPage() {
  // CondiÃ§Ã£o real Meta
  const [meta, setMeta] = useState<{ loading: boolean; denied: boolean; error: string | null; connected: boolean; integrations: MetaIntegration[] }>({
    loading: true,
    denied: false,
    error: null,
    connected: false,
    integrations: [],
  });
  // Flags de configuraÃ§Ã£o (admin)
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  // Health probes (admin)
  const [health, setHealth] = useState<Record<string, { status: ProbeStatus; detail?: string }>>({});
  const [adminDenied, setAdminDenied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    setMeta((m) => ({ ...m, loading: true }));
    setNote(null);
    try {
      const r = await fetch('/api/integrations/meta');
      if (r.status === 401) {
        setMeta({ loading: false, denied: true, error: null, connected: false, integrations: [] });
      } else if (!r.ok) {
        setMeta({ loading: false, denied: false, error: `Falha ao carregar integraÃ§Ãµes (HTTP ${r.status}).`, connected: false, integrations: [] });
      } else {
        const d = await r.json();
        setMeta({
          loading: false,
          denied: false,
          error: null,
          connected: Boolean(d?.connected),
          integrations: Array.isArray(d?.integrations) ? d.integrations : [],
        });
      }
    } catch {
      setMeta({ loading: false, denied: false, error: 'Falha de rede ao carregar integraÃ§Ãµes.', connected: false, integrations: [] });
    }
  }, []);

  const loadAdmin = useCallback(async () => {
    const [cfg, hp] = await Promise.all([
      fetch('/api/integrations/config').then((r) => (r.ok ? r.json().then((d: { providers?: ConfigProvider[] }) => d) : null)).catch(() => null),
      fetch('/api/integrations/health').then((r) => (r.ok ? r.json().then((d: { health?: Array<{ provider: string; status: ProbeStatus; detail?: string }> }) => d) : null)).catch(() => null),
    ]);
    if (!cfg && !hp) {
      setAdminDenied(true);
      return;
    }
    setAdminDenied(false);
    if (cfg?.providers) {
      const m: Record<string, boolean> = {};
      for (const p of cfg.providers) m[p.id] = p.configured;
      setConfigured(m);
    }
    if (hp?.health) {
      const m: Record<string, { status: ProbeStatus; detail?: string }> = {};
      for (const h of hp.health) m[h.provider] = { status: h.status, detail: h.detail };
      setHealth(m);
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);
  useEffect(() => {
    void loadAdmin();
  }, [loadAdmin]);

  const checkHealth = async () => {
    setChecking(true);
    setNote(null);
    try {
      const r = await fetch('/api/integrations/health');
      if (r.ok) {
        const d = await r.json();
        const m: Record<string, { status: ProbeStatus; detail?: string }> = {};
        for (const h of d.health ?? []) m[h.provider] = { status: h.status, detail: h.detail };
        setHealth(m);
        setNote('Health atualizado.');
      } else {
        setNote(`Health indisponÃ­vel (HTTP ${r.status}).`);
      }
    } catch {
      setNote('Falha de rede ao checar saÃºde.');
    } finally {
      setChecking(false);
    }
  };

  const refreshMetaToken = async () => {
    setNote(null);
    try {
      const r = await fetch('/api/integrations/meta/refresh-token', { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setNote(`Token da Meta renovado (expira em ~${d.expiresIn ?? '?'}s).`);
      else if (r.status === 409) setNote('Meta nÃ£o conectada neste tenant ainda.');
      else if (r.status === 503) setNote('Meta nÃ£o configurada no servidor (META_* ausentes).');
      else setNote(`Falha ao renovar token (HTTP ${r.status}${d.detail ? ` â€” ${d.detail}` : ''}).`);
    } catch {
      setNote('Falha de rede ao renovar o token da Meta.');
    }
  };

  // TikTok: renova o access token via refresh_token (sÃ³ OAuth + admin). Mesmo
  // padrÃ£o da Meta; a rota degrada com 409/503/502 honestos.
  const refreshTikTokToken = async () => {
    setNote(null);
    try {
      const r = await fetch('/api/integrations/tiktok/refresh-token', { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setNote(`Token do TikTok renovado (expira em ~${d.expiresIn ?? '?'}s).`);
      else if (r.status === 409) setNote('TikTok nÃ£o conectado via OAuth neste tenant (nada para renovar).');
      else if (r.status === 503) setNote('TikTok nÃ£o configurado ou fila indisponÃ­vel no servidor.');
      else setNote(`Falha ao renovar o token do TikTok (HTTP ${r.status}${d.detail ? ` â€” ${d.detail}` : ''}).`);
    } catch {
      setNote('Falha de rede ao renovar o token do TikTok.');
    }
  };

  const startMetaOAuth = async () => {
    setNote(null);
    const url = '/api/auth/meta?provider=whatsapp';
    try {
      const r = await fetch(url, { redirect: 'manual' });
      if (r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400)) {
        window.location.assign(url);
        return;
      }
      if (r.status === 503) setNote('Meta nÃ£o configurada no servidor (META_APP_ID/SECRET ausentes) â€” item P0 do hpanel.');
      else if (r.status === 401) setNote('FaÃ§a login para conectar a Meta.');
      else setNote(`Falha ao iniciar o OAuth da Meta (HTTP ${r.status}).`);
    } catch {
      setNote('Falha de rede ao iniciar o OAuth da Meta.');
    }
  };

  // TikTok: mesmo padrÃ£o da Meta â€” inicia em /api/auth/tiktok (302 para o
  // authorize com PKCE), o callback cifra + persiste no AgentMemory do tenant.
  const startTikTokOAuth = async () => {
    setNote(null);
    const url = '/api/auth/tiktok';
    try {
      const r = await fetch(url, { redirect: 'manual' });
      if (r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400)) {
        window.location.assign(url);
        return;
      }
      if (r.status === 503) setNote('TikTok nÃ£o configurado no servidor (TIKTOK_CLIENT_KEY/SECRET ausentes).');
      else if (r.status === 401) setNote('FaÃ§a login para conectar o TikTok.');
      else setNote(`Falha ao iniciar o OAuth do TikTok (HTTP ${r.status}).`);
    } catch {
      setNote('Falha de rede ao iniciar o OAuth do TikTok.');
    }
  };

  const saveProvider = async (def: ProviderDef, value: Record<string, unknown>) => {
    setNote(null);
    try {
      const r = await fetch('/api/integrations/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: def.id, value }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setConfigured((c) => ({ ...c, [def.id]: true }));
        setNote(`${def.name}: configuraÃ§Ã£o salva.`);
        void loadAdmin();
      } else if (r.status === 400) setNote(`${def.name}: ${d.error ?? 'campos invÃ¡lidos'}.`);
      else setNote(`${def.name}: falha (HTTP ${r.status}).`);
    } catch {
      setNote(`${def.name}: falha de rede ao salvar.`);
    }
  };

  const clearProvider = async (def: ProviderDef) => {
    setNote(null);
    if (!window.confirm(`Remover a configuraÃ§Ã£o de ${def.name}?`)) return;
    try {
      const r = await fetch(`/api/integrations/config?provider=${encodeURIComponent(def.id)}`, { method: 'DELETE' });
      if (r.ok) {
        setConfigured((c) => ({ ...c, [def.id]: false }));
        setNote(`${def.name}: configuraÃ§Ã£o removida.`);
        void loadAdmin();
      } else setNote(`${def.name}: falha ao remover (HTTP ${r.status}).`);
    } catch {
      setNote(`${def.name}: falha de rede ao remover.`);
    }
  };

  const disconnectMeta = async (provider: string) => {
    if (!window.confirm(`Desconectar a integraÃ§Ã£o ${provider}?`)) return;
    setNote(null);
    try {
      const r = await fetch(`/api/integrations/meta?provider=${encodeURIComponent(provider)}`, { method: 'DELETE' });
      setNote(r.ok ? `IntegraÃ§Ã£o ${provider} desconectada.` : `Falha ao desconectar (HTTP ${r.status}).`);
      if (r.ok) await loadMeta();
    } catch {
      setNote('Falha de rede ao desconectar.');
    }
  };

  const statusOf = (id: string): { status: ProbeStatus; detail?: string } =>
    health[id] ?? { status: configured[id] ? 'ok' : 'not_configured' };

  return (
    <AppShell>
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">IntegraÃ§Ãµes</h1>
            <p className="text-sm text-gray-400">
              Hub de integraÃ§Ãµes: condiÃ§Ã£o real, fluxo de integraÃ§Ã£o, health check e renovaÃ§Ã£o de token. Nenhum segredo Ã© exibido.
            </p>
          </div>

          {note && (
            <div className="mb-4 p-3 text-sm rounded-lg bg-white/5 border border-white/10 text-gray-300">{note}</div>
          )}

          {/* ===== CondiÃ§Ã£o real da Meta ===== */}
          <section className="mb-8">
            <SectionTitle>ConexÃ£o Meta (Facebook Â· Instagram Â· WhatsApp)</SectionTitle>
            {meta.loading ? (
              <p className="text-gray-400 text-sm">Carregandoâ€¦</p>
            ) : meta.denied ? (
              <div role="status" aria-live="polite" className="p-3 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg">
                FaÃ§a login para ver as integraÃ§Ãµes da sua organizaÃ§Ã£o.
              </div>
            ) : meta.error ? (
              <div role="status" aria-live="polite" className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">{meta.error}</div>
            ) : (
              <div className="space-y-3">
                {meta.integrations.length > 1 && (
                  <p className="text-xs text-gray-400">
                    {meta.integrations.length} contas Meta conectadas. Em cada operaÃ§Ã£o de publicaÃ§Ã£o/disparo
                    vocÃª escolhe a conta (botÃ£o â€œPÃ¡gina / NÃºmero / Contaâ€ nos formulÃ¡rios).
                  </p>
                )}
                {meta.integrations.length === 0 && (
                  <div className="p-4 bg-[#0D0915] border border-white/10 rounded-2xl text-sm text-gray-400">
                    Nenhuma integraÃ§Ã£o Meta conectada.
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => void startMetaOAuth()}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                      >
                        Conectar via OAuth
                      </button>
                      <a
                        href="/whatsapp"
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/15 text-gray-300 hover:bg-white/5"
                      >
                        Abrir WhatsApp â†’
                      </a>
                    </div>
                  </div>
                )}
                {meta.integrations.map((i) => (
                  <div key={i.id} className="p-4 bg-[#0D0915] border border-white/10 rounded-2xl text-sm">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-200 font-semibold">
                          {providerLabel(i.provider)}
                          {i.displayName ? <span className="text-gray-400 font-normal"> Â· {i.displayName}</span> : null}
                        </span>
                        <ApiBadge layer="official" />
                      </div>
                      <HealthPill status={i.status === 'DISCONNECTED' ? 'error' : 'ok'} detail={i.status ?? undefined} />
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <dt className="text-gray-400">PÃ¡gina Meta</dt>
                      <dd className="text-gray-300 truncate" title={i.metaPageId ?? undefined}>{i.metaPageId ?? 'â€”'}</dd>
                      <dt className="text-gray-400">WhatsApp Business</dt>
                      <dd className="text-gray-300 truncate" title={i.whatsappBusinessAccountId ?? undefined}>{i.whatsappBusinessAccountId ?? 'â€”'}</dd>
                      <dt className="text-gray-400">Token expira</dt>
                      <dd className="text-gray-300">{i.tokenExpiresAt ? new Date(i.tokenExpiresAt).toLocaleString('pt-BR') : 'â€”'}</dd>
                    </dl>
                    {i.lastError && <p className="mt-2 text-xs text-red-400">Ãºltimo erro: {i.lastError}</p>}
                    {i.status !== 'DISCONNECTED' && (
                      <button
                        onClick={() => void disconnectMeta(i.provider)}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10"
                      >
                        Desconectar
                      </button>
                    )}
                  </div>
                ))}
                {/* AÃ§Ãµes de admin sobre a Meta */}
                {!adminDenied && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void refreshMetaToken()}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                    >
                      Renovar token da Meta
                    </button>
                    <button
                      onClick={() => void checkHealth()}
                      disabled={checking}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/15 text-gray-300 hover:bg-white/5 disabled:opacity-50"
                    >
                      {checking ? 'Checandoâ€¦' : 'Checar saÃºde de tudo'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ===== Provedores: API Oficial ===== */}
          <section className="mb-8">
            <SectionTitle accent>API Oficial</SectionTitle>
            {adminDenied && <AdminNote />}
            <div className="grid gap-3">
              {OFFICIAL.map((def) => (
                <ProviderCard
                  key={def.id}
                  def={def}
                  state={statusOf(def.id)}
                  configured={Boolean(configured[def.id])}
                  admin={adminDenied}
                  onSave={saveProvider}
                  onClear={clearProvider}
                  onOAuth={def.id === 'tiktok' ? startTikTokOAuth : undefined}
                  onRefresh={def.id === 'tiktok' ? refreshTikTokToken : undefined}
                />
              ))}
            </div>
          </section>

          {/* ===== Provedores: Sem API / AvanÃ§ado ===== */}
          <section className="mb-8">
            <SectionTitle accent tone="warn">Sem API Â· AvanÃ§ado</SectionTitle>
            <p className="text-xs text-gray-400 mb-3">
              MÃ©todos nÃ£o oficiais (scraping, QR Code, automaÃ§Ã£o de navegador). SÃ³ o parÃ¢metro Ã©
              guardado; a execuÃ§Ã£o Ã© nÃ£o-oficial e de sua responsabilidade.
            </p>
            {adminDenied && <AdminNote />}
            <div className="grid gap-3">
              {SEM_API.map((def) => (
                <ProviderCard
                  key={def.id}
                  def={def}
                  state={statusOf(def.id)}
                  configured={Boolean(configured[def.id])}
                  admin={adminDenied}
                  risk
                  onSave={saveProvider}
                  onClear={clearProvider}
                />
              ))}
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function SectionTitle({ children, accent, tone = 'ok' }: { children: React.ReactNode; accent?: boolean; tone?: 'ok' | 'warn' }) {
  return (
    <h2
      className={`text-sm font-bold uppercase tracking-wide mb-3 ${
        accent ? (tone === 'warn' ? 'text-amber-400' : 'text-purple-400') : 'text-gray-300'
      }`}
    >
      {children}
    </h2>
  );
}

function AdminNote() {
  return (
    <div className="mb-3 p-3 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg">
      O fluxo de integraÃ§Ã£o e o health check sÃ£o exclusivos de admin/owner. FaÃ§a login como admin para configurar.
    </div>
  );
}

interface ProviderCardProps {
  def: ProviderDef;
  state: { status: ProbeStatus; detail?: string };
  configured: boolean;
  admin: boolean;
  risk?: boolean;
  onSave: (def: ProviderDef, value: Record<string, unknown>) => void;
  onClear: (def: ProviderDef) => void;
  onOAuth?: () => void;
  onRefresh?: () => void;
}

function ProviderCard({ def, state, configured, admin, risk, onSave, onClear, onOAuth, onRefresh }: ProviderCardProps) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [exec, setExec] = useState<{ ok: boolean; msg: string } | null>(null);
  const hasForm = def.fields.length > 0;
  const missingRequired = hasForm ? def.fields.filter((f) => f.required && !values[f.key]) : [];
  const isOutbound = (OUTBOUND_PROVIDER_IDS as readonly string[]).includes(def.id);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value: Record<string, unknown> = {};
    for (const f of def.fields) if (values[f.key]?.trim() !== '') value[f.key] = values[f.key].trim();
    onSave(def, value);
    setOpen(false);
    setValues({});
  };

  const testOutbound = async () => {
    setExec({ ok: false, msg: 'Enviando evento de testeâ€¦' });
    try {
      const r = await fetch('/api/integrations/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: def.id, test: true }),
      });
      const d = await r.json().catch(() => ({} as { ok?: boolean; httpStatus?: number; error?: string; detail?: string }));
      if (r.status === 409) setExec({ ok: false, msg: `NÃ£o configurado: ${d.detail ?? 'faltam campos do alvo'}.` });
      else if (r.status === 503) setExec({ ok: false, msg: 'Banco/fila indisponÃ­vel (503).' });
      else if (r.ok && d.ok) setExec({ ok: true, msg: `Alvo respondeu HTTP ${d.httpStatus ?? '?'}.` });
      else if (r.ok && d.error) setExec({ ok: false, msg: `Alvo falhou: ${d.error}${d.detail ? ` â€” ${d.detail}` : ''}.` });
      else setExec({ ok: false, msg: `Falha (HTTP ${r.status}${d.detail ? ` â€” ${d.detail}` : ''}).` });
    } catch {
      setExec({ ok: false, msg: 'Falha de rede ao testar o envio.' });
    }
  };

  return (
    <div className="p-4 bg-[#0D0915] border border-white/10 rounded-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-200 font-semibold text-sm">{def.name}</span>
            <ApiBadge layer={def.layer} />
            {configured && <HealthPill status="ok" detail="configurado" />}
          </div>
          <p className="text-xs text-gray-400 mt-1">{def.summary}</p>
        </div>
        <HealthPill status={state.status} detail={state.detail} />
      </div>

      {risk && def.riskNote && (
        <div className="mt-3">
          <RiskBanner>{def.riskNote}</RiskBanner>
        </div>
      )}

      {def.guidance && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-purple-300 hover:text-purple-200 select-none">
            Como conectar (passos guiados)
          </summary>
          <ol className="mt-2 space-y-1 pl-5 list-decimal text-gray-400">
            {def.guidance.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ol>
        </details>
      )}

      {hasForm ? (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setOpen((o) => !o)}
              disabled={admin}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {open ? 'Fechar' : 'Integrar'}
            </button>
            {onOAuth && (
              <button
                onClick={() => void onOAuth()}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
              >
                Conectar via OAuth
              </button>
            )}
            {onRefresh && !admin && configured && (
              <button
                onClick={() => void onRefresh()}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
              >
                Renovar token
              </button>
            )}
            {configured && !admin && (
              <button
                onClick={() => onClear(def)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/15 text-gray-400 hover:text-white hover:bg-white/5"
              >
                Remover
              </button>
            )}
            {isOutbound && configured && !admin && (
              <button
                onClick={() => void testOutbound()}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
              >
                Testar envio
              </button>
            )}
          </div>
          {exec && (
            <p className={`mt-2 text-xs ${exec.ok ? 'text-emerald-400' : 'text-amber-300'}`}>
              {exec.msg}
            </p>
          )}
          {open && (
            <form onSubmit={submit} className="mt-3 space-y-2">
              {def.fields.map((f) => (
                <label key={f.key} className="block text-xs text-gray-400">
                  {f.label}
                  {f.required && <span className="text-red-400"> *</span>}
                  <input
                    type={f.secret ? 'password' : 'text'}
                    value={values[f.key] ?? ''}
                    placeholder={f.placeholder}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 text-sm text-white bg-black/30 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50"
                    autoComplete="off"
                  />
                </label>
              ))}
              {missingRequired.length > 0 && (
                <p className="text-xs text-amber-400">ObrigatÃ³rios: {missingRequired.map((f) => f.label).join(', ')}</p>
              )}
              <button
                type="submit"
                disabled={missingRequired.length > 0}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
              >
                Salvar
              </button>
            </form>
          )}
        </div>
      ) : (
        // Provedores oficiais sem campos = geridos por outro fluxo (OAuth da Meta).
        <div className="mt-3 text-xs text-gray-400">Gerenciado via {def.id === 'whatsapp' ? 'OAuth da Meta + tela /whatsapp' : 'OAuth da Meta'}.</div>
      )}
    </div>
  );
}

function providerLabel(p: string): string {
  switch (p) {
    case 'meta':
      return 'Meta (Facebook)';
    case 'instagram':
      return 'Instagram';
    case 'whatsapp':
      return 'WhatsApp Business';
    default:
      return p;
  }
}
