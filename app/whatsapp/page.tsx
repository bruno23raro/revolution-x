'use client';

// WhatsApp Business — FASE 1 UI.
//
//  • Disparo em massa (Cloud API oficial da Meta): números → /api/whatsapp/send.
//  • Templates oficiais: listagem + criação (/api/whatsapp/templates).
//  • Chatbot configurável (motor de regras puro + fluxo visual de etapas,
//    variáveis {{nome}} e quick replies — FASE 3 · slice 2): /api/whatsapp/chatbot.
//    O webhook Meta dispara a resposta automática (chatbotAutoReply).
//  • "Sem API / Avançado": extração de contatos declarada + aviso de risco
//    (o hub DECLARA o método; a execução não-oficial é de responsabilidade do
//    usuário e ainda não há executor no produto).
//
// Design: lilás + preto + branco. Nenhum segredo no front-end.

import AppShell from '@/components/AppShell';
import RiskBanner from '@/components/RiskBanner';
import type {
  ChatbotConfig,
  ChatbotRule,
  ChatbotStep,
  MatchType,
} from '@/integrations/meta/whatsappChatbot';
import { useEffect, useState } from 'react';

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const;
const MATCH_TYPES: MatchType[] = ['keyword', 'contains', 'exact', 'regex'];

const EMPTY_RULE = (): ChatbotRule => ({ matchType: 'keyword', pattern: '', response: '', enabled: true });
const uniqueStepId = () => `step-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

export default function WhatsAppPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/session', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        // Bug fix: session API returns { authenticated: false } without error/unauthorized keys
        // Check data.authenticated directly instead of checking for error/unauthorized which are undefined
        setIsAuthenticated(data.authenticated === true);
      } catch {
        setIsAuthenticated(false);
      }
      setLoading(false);
    })();
  }, []);
  return (
    <AppShell>
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">WhatsApp Business</h1>
            <p className="text-sm text-gray-400">
              Disparo em massa, templates oficiais e chatbot configurável — 100% pela API oficial da Meta.
            </p>
          </div>

          <div className="grid gap-6">
            <MassSendCard />
            <div className="grid gap-6 md:grid-cols-2">
              <TemplatesCard />
              <ChatbotCard />
            </div>
            <AdvancedExtractionCard />
          </div>
        </div>
      </main>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Disparo em massa                                                    */
/* ------------------------------------------------------------------ */

function MassSendCard() {
  const [numbers, setNumbers] = useState('');
  const [text, setText] = useState('');
  const [useTemplate, setUseTemplate] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplVars, setTplVars] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; total: number; sent: number; failed: number; tracked: boolean; msg: string } | null>(null);
  // MULTICONTAS — seletor de número/conta WhatsApp, só com 2+.
  const [metaList, setMetaList] = useState<Array<{ id: string; provider: string; phoneNumberId: string | null; whatsappBusinessAccountId: string | null; displayName?: string | null }>>([]);
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

  // O resolver de envio ancora em provider whatsapp|facebook.
  const waAccounts = metaList.filter((i) => i.provider === 'whatsapp' || i.provider === 'facebook');

  const parseNumbers = () =>
    numbers
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean);

  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const body: Record<string, unknown> = { to: parseNumbers() };
      if (useTemplate && tplName.trim()) {
        body.template = {
          name: tplName.trim(),
          variables: tplVars.split('\n').map((v) => v.trim()).filter(Boolean),
        };
      } else if (text.trim()) {
        body.text = text.trim();
      }
      if (account) body.account = account; // MULTICONTAS — ancorado número escolhido
      const r = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setResult({ ok: true, total: d.total ?? 0, sent: d.sent ?? 0, failed: d.failed ?? 0, tracked: Boolean(d.tracked), msg: 'Enviado.' });
      } else if (r.status === 409) setResult({ ok: false, total: 0, sent: 0, failed: 0, tracked: false, msg: 'WhatsApp não conectado neste tenant. Conecte em /integrations.' });
      else if (r.status === 503) setResult({ ok: false, total: 0, sent: 0, failed: 0, tracked: false, msg: 'Meta não configurada no servidor (META_* / token ausentes) — item P0 do hpanel.' });
      else if (r.status === 400) setResult({ ok: false, total: 0, sent: 0, failed: 0, tracked: false, msg: d.error ? `Entrada inválida: ${d.error}` : 'Entrada inválida.' });
      else if (r.status === 401) setResult({ ok: false, total: 0, sent: 0, failed: 0, tracked: false, msg: 'Faça login para disparar.' });
      else setResult({ ok: false, total: 0, sent: 0, failed: 0, tracked: false, msg: `Falha ao enviar (HTTP ${r.status}).` });
    } catch {
      setResult({ ok: false, total: 0, sent: 0, failed: 0, tracked: false, msg: 'Falha de rede ao enviar.' });
    } finally {
      setBusy(false);
    }
  };

  const count = parseNumbers().length;

  return (
    <Card>
      <CardHeader title="Disparo em massa" badge="API Oficial" />
      <div className="space-y-3">
        <label className="block text-xs text-gray-400">
          Números (um por linha, ou separados por vírgula)
          <textarea
            rows={4}
            value={numbers}
            onChange={(e) => setNumbers(e.target.value)}
            placeholder={'5511999999999\n551188888888\n+55 21 7777 7777'}
            className={inputCls}
          />
        </label>
        <label className="block text-xs text-gray-400">
          Mensagem <span className="text-gray-400">(texto simples, se não usar template)</span>
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Olá! ..." className={inputCls} />
        </label>

        {waAccounts.length > 1 && (
          <label className="block text-xs text-gray-400">
            Número / conta <span className="text-gray-400">(dispara por este número)</span>
            <select value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls}>
              <option value="" className="bg-[#0D0915]">Padrão (mais recente)</option>
              {waAccounts.map((i) => (
                <option key={i.id} value={i.id} className="bg-[#0D0915]">
                  {i.displayName || i.phoneNumberId || i.whatsappBusinessAccountId || i.provider}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input type="checkbox" checked={useTemplate} onChange={(e) => setUseTemplate(e.target.checked)} className="accent-purple-500" />
          Usar template oficial
        </label>
        {useTemplate && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-gray-400">
              Nome do template
              <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="boas_vindas" className={inputCls} />
            </label>
            <label className="block text-xs text-gray-400">
              Variáveis <span className="text-gray-400">(uma por linha)</span>
              <input value={tplVars} onChange={(e) => setTplVars(e.target.value)} placeholder={'Maria\n1234'} className={inputCls} />
            </label>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => void send()}
            disabled={busy || count === 0}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
          >
            {busy ? 'Enviando…' : `Enviar ${count > 0 ? `para ${count}` : ''}`}
          </button>
          <span className="text-xs text-gray-400">Limite: 500 destinatários por disparo.</span>
        </div>

        {result && (
          result.ok ? (
            <div role="status" aria-live="polite" className="p-3 text-sm rounded-lg bg-green-400/10 border border-green-400/25 text-green-300">
              {result.msg} — {result.sent}/{result.total} enviados, {result.failed} falhas{result.tracked ? ', rastreado' : ' (fila indisponível, envio ok)'}
            </div>
          ) : (
            <div role="status" aria-live="polite" className="p-3 text-sm rounded-lg bg-amber-400/10 border border-amber-400/25 text-amber-300">{result.msg}</div>
          )
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Templates oficiais                                                  */
/* ------------------------------------------------------------------ */

interface TemplateRow {
  name: string;
  category?: string;
  status?: string;
  language?: string;
}

function TemplatesCard() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loadMsg, setLoadMsg] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0] as string);
  const [language, setLanguage] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => {
    fetch('/api/whatsapp/templates')
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.ok) {
          setTemplates(Array.isArray(d.templates) ? d.templates : []);
          setLoadMsg(null);
        } else if (r.status === 409) setLoadMsg('WhatsApp não conectado neste tenant.');
        else if (r.status === 503) setLoadMsg('Meta não configurada no servidor (item P0).');
        else if (r.status === 401) setLoadMsg('Faça login para listar templates.');
        else setLoadMsg(`Não foi possível listar (HTTP ${r.status}).`);
      })
      .catch(() => setLoadMsg('Falha de rede ao listar templates.'));
  };

  useEffect(load, []);

  const create = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), category, language: language.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg({ ok: true, text: `Template ${d.name ?? name} criado (ou já existe).` });
        setName('');
        load();
      } else if (r.status === 401) setMsg({ ok: false, text: 'Somente admin/owner cria templates.' });
      else if (r.status === 409) setMsg({ ok: false, text: 'WhatsApp não conectado neste tenant.' });
      else if (r.status === 503) setMsg({ ok: false, text: 'Meta não configurada no servidor (item P0).' });
      else setMsg({ ok: false, text: d.detail ? `Falha: ${d.detail}` : `Falha ao criar (HTTP ${r.status}).` });
    } catch {
      setMsg({ ok: false, text: 'Falha de rede ao criar.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Templates oficiais" badge="API Oficial" />
      <div className="space-y-3">
        <div className="max-h-48 overflow-y-auto space-y-1.5">
          {loadMsg && <p className="text-xs text-amber-300">{loadMsg}</p>}
          {!loadMsg && templates.length === 0 && <p className="text-xs text-gray-400">Nenhum template no escopo atual.</p>}
          {templates.map((t, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs bg-black/20 border border-white/10 rounded-lg px-2.5 py-1.5">
              <span className="text-gray-200 truncate" title={t.name}>{t.name}</span>
              <span className="text-gray-400 shrink-0">{[t.category, t.status].filter(Boolean).join(' · ') || '—'}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-3">
          <p className="text-xs font-semibold text-gray-300 mb-2">Criar template</p>
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="Nome do template (snake_case)" value={name} onChange={(e) => setName(e.target.value)} placeholder="nome (snake_case)" className={inputCls} />
            <select aria-label="Categoria do template" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-[#0D0915]">{c}</option>
              ))}
            </select>
            <input aria-label="Idioma do template (ex.: pt_BR)" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="idioma (ex.: pt_BR)" className={inputCls} />
            <button
              onClick={() => void create()}
              disabled={busy || !name.trim()}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
            >
              {busy ? 'Criando…' : 'Criar'}
            </button>
          </div>
          {msg && (
            <p role="status" aria-live="polite" className={`mt-2 text-xs ${msg.ok ? 'text-green-300' : 'text-amber-300'}`}>{msg.text}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Chatbot configurável                                                */
/* ------------------------------------------------------------------ */

function ChatbotCard() {
  const [cfg, setCfg] = useState<ChatbotConfig | null>(null);
  const [loadMsg, setLoadMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    fetch('/api/whatsapp/chatbot')
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.ok) {
          setCfg(
            d.config ?? {
              enabled: false,
              greeting: '',
              fallback: '',
              timezone: '',
              activeFromHour: 9,
              activeToHour: 18,
              rules: [],
              steps: [],
              vars: {},
              useAI: false,
              aiSystemPrompt: '',
            },
          );
          setLoadMsg(null);
        } else if (r.status === 401) setLoadMsg('Somente admin/owner configura o chatbot.');
        else setLoadMsg(`Não foi possível carregar o chatbot (HTTP ${r.status}).`);
      })
      .catch(() => setLoadMsg('Falha de rede ao carregar o chatbot.'));
  };

  useEffect(load, []);

  const set = (patch: Partial<ChatbotConfig>) => setCfg((c) => (c ? { ...c, ...patch } : c));
  const setRule = (i: number, patch: Partial<ChatbotRule>) =>
    setCfg((c) => (c ? { ...c, rules: c.rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) } : c));
  const addRule = () => setCfg((c) => (c ? { ...c, rules: [...c.rules, EMPTY_RULE()] } : c));
  const delRule = (i: number) => setCfg((c) => (c ? { ...c, rules: c.rules.filter((_, idx) => idx !== i) } : c));

  /* Fluxo visual (steps) + variáveis */
  const setStep = (i: number, patch: Partial<ChatbotStep>) =>
    setCfg(
      (c) =>
        c ? { ...c, steps: (c.steps ?? []).map((s, idx) => (idx === i ? { ...s, ...patch } : s)) } : c,
    );
  const addStep = () =>
    setCfg((c) => (c ? { ...c, steps: [...(c.steps ?? []), { id: uniqueStepId(), response: '' }] } : c));
  const delStep = (i: number) =>
    setCfg((c) => {
      if (!c) return c;
      const cur = c.steps ?? [];
      const removed = cur[i];
      const next = cur.filter((_, idx) => idx !== i);
      // Ponteiros órfãos: quem apontava para o nó removido vira "fim do fluxo".
      return {
        ...c,
        steps: next.map((s) =>
          removed?.id && s.nextStepId === removed.id ? { ...s, nextStepId: null } : s,
        ),
      };
    });
  const moveStep = (i: number, dir: -1 | 1) =>
    setCfg((c) => {
      if (!c) return c;
      const cur = c.steps ?? [];
      const j = i + dir;
      if (j < 0 || j >= cur.length) return c;
      const arr = [...cur];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...c, steps: arr };
    });

  const setVarValue = (key: string, value: string) =>
    setCfg((c) => (c ? { ...c, vars: { ...c.vars, [key]: value } } : c));
  const renameVar = (oldKey: string, newKey: string) =>
    setCfg((c) => {
      if (!c) return c;
      const vars = { ...c.vars };
      const value = vars[oldKey];
      delete vars[oldKey];
      if (newKey) vars[newKey] = value;
      return { ...c, vars };
    });
  const delVar = (key: string) =>
    setCfg((c) =>
      c ? { ...c, vars: Object.fromEntries(Object.entries(c.vars ?? {}).filter(([k]) => k !== key)) } : c,
    );
  const addVar = () => setCfg((c) => (c ? { ...c, vars: { ...c.vars, variavel: '' } } : c));

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/whatsapp/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setMsg(`Chatbot salvo (${d.rules ?? 0} regras, ${d.steps ?? 0} etapas, ${d.enabled ? 'ativado' : 'inativo'}).`);
      else if (r.status === 401) setMsg('Somente admin/owner salva o chatbot.');
      else setMsg(`Falha ao salvar (HTTP ${r.status}).`);
    } catch {
      setMsg('Falha de rede ao salvar.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Remover toda a configuração do chatbot?')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/whatsapp/chatbot', { method: 'DELETE' });
      if (r.ok) {
        setMsg('Configuração do chatbot removida.');
        setCfg(null);
        load();
      } else setMsg(`Falha ao remover (HTTP ${r.status}).`);
    } catch {
      setMsg('Falha de rede ao remover.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Chatbot configurável" badge="API Oficial" />
      {loadMsg && <p className="text-xs text-amber-300 mb-2">{loadMsg}</p>}
      {!cfg ? (
        <p className="text-xs text-gray-400">Sem configuração (ou sem acesso admin).</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={cfg.enabled}
                onChange={(e) => set({ enabled: e.target.checked })}
                className="accent-purple-500"
              />
              Ativado
            </label>
            <button onClick={() => void remove()} className="text-xs text-red-400 hover:underline">
              Remover
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input aria-label="Saudação (1º contato)" value={cfg.greeting ?? ''} onChange={(e) => set({ greeting: e.target.value })} placeholder="Saudação (1º contato)" className={inputCls} />
            <input aria-label="Resposta padrão (fallback)" value={cfg.fallback ?? ''} onChange={(e) => set({ fallback: e.target.value })} placeholder="Resposta padrão (fallback)" className={inputCls} />
            <input aria-label="Horário de início" value={String(cfg.activeFromHour ?? 9)} onChange={(e) => set({ activeFromHour: Number(e.target.value) })} placeholder="Horário de início" className={inputCls} />
            <input aria-label="Horário de fim" value={String(cfg.activeToHour ?? 18)} onChange={(e) => set({ activeToHour: Number(e.target.value) })} placeholder="Horário de fim" className={inputCls} />
            <input aria-label="Fuso horário (ex.: America/Sao_Paulo)" value={cfg.timezone ?? ''} onChange={(e) => set({ timezone: e.target.value })} placeholder="Fuso (America/Sao_Paulo)" className={inputCls} />
            <div />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-300 mb-1.5">Regras</p>
            <div className="space-y-2">
              {cfg.rules.map((r, i) => (
                <div key={i} className="p-2 bg-black/20 border border-white/10 rounded-lg space-y-1.5">
                  <div className="grid grid-cols-4 gap-1.5">
                    <select
                      aria-label={`Regra ${i + 1}: tipo de correspondência`}
                      value={r.matchType}
                      onChange={(e) => setRule(i, { matchType: e.target.value as MatchType })}
                      className={inputCls}
                    >
                      {MATCH_TYPES.map((m) => (
                        <option key={m} value={m} className="bg-[#0D0915]">{m}</option>
                      ))}
                    </select>
                    <input aria-label={`Regra ${i + 1}: padrão`} value={r.pattern} onChange={(e) => setRule(i, { pattern: e.target.value })} placeholder="padrão" className={inputCls} />
                    {r.matchType === 'regex' ? (
                      <input aria-label={`Regra ${i + 1}: flags de regex (ex.: i)`} value={r.flags ?? ''} onChange={(e) => setRule(i, { flags: e.target.value })} placeholder="flags (i)" className={inputCls} />
                    ) : (
                      <input aria-label={`Regra ${i + 1}: ação (opcional)`} value={r.action ?? ''} onChange={(e) => setRule(i, { action: e.target.value })} placeholder="ação (opc.)" className={inputCls} />
                    )}
                    <button onClick={() => delRule(i)} className="text-xs text-red-400 self-center">remover</button>
                  </div>
                  <input
                    aria-label={`Regra ${i + 1}: resposta`}
                    value={r.response}
                    onChange={(e) => setRule(i, { response: e.target.value })}
                    placeholder="resposta"
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
            <button onClick={addRule} className="mt-2 text-xs text-purple-300 hover:underline">+ adicionar regra</button>
          </div>

          {/* Fluxo visual — etapas conectadas (FASE 3 · slice 2) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-gray-300">Fluxo visual (etapas)</p>
              <span className="text-[10px] text-gray-400">
                condição → resposta → próxima · {`{{variavel}}`} aceita
              </span>
            </div>
            <div className="space-y-2">
              {(cfg.steps ?? []).map((s, i) => (
                <div key={i} className="p-2 bg-black/20 border border-white/10 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => moveStep(i, -1)}
                      disabled={i === 0}
                      className="text-xs text-gray-400 hover:text-gray-300 disabled:opacity-30"
                      title="Mover para cima"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveStep(i, 1)}
                      disabled={i >= (cfg.steps ?? []).length - 1}
                      className="text-xs text-gray-400 hover:text-gray-300 disabled:opacity-30"
                      title="Mover para baixo"
                    >
                      ↓
                    </button>
                    <span className="text-[10px] font-mono text-purple-300">{s.id || `step-${i + 1}`}</span>
                    {i < (cfg.steps ?? []).length - 1 && <span className="text-gray-400 text-xs">↓</span>}
                    <button onClick={() => delStep(i)} className="ml-auto text-xs text-red-400">
                      remover
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <select
                      aria-label={`Etapa ${i + 1}: condição`}
                      value={s.matchType ?? ''}
                      onChange={(e) =>
                        setStep(i, {
                          matchType: e.target.value ? (e.target.value as MatchType) : undefined,
                        })
                      }
                      className={inputCls}
                    >
                      <option value="" className="bg-[#0D0915]">sempre (sem condição)</option>
                      {MATCH_TYPES.map((m) => (
                        <option key={m} value={m} className="bg-[#0D0915]">
                          se mensagem: {m}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={`Etapa ${i + 1}: padrão (ex.: preço)`}
                      value={s.pattern ?? ''}
                      onChange={(e) => setStep(i, { pattern: e.target.value || undefined })}
                      placeholder="padrão (ex.: preço)"
                      className={inputCls}
                    />
                    {s.matchType === 'regex' ? (
                      <input
                        aria-label={`Etapa ${i + 1}: flags de regex (ex.: i)`}
                        value={s.flags ?? ''}
                        onChange={(e) => setStep(i, { flags: e.target.value || undefined })}
                        placeholder="flags (i)"
                        className={inputCls}
                      />
                    ) : (
                      <label
                        className="flex items-center gap-1 text-[10px] text-gray-400 self-center cursor-pointer"
                        title="Encerra o fluxo neste nó (não segue a próxima etapa)"
                      >
                        <input
                          type="checkbox"
                          checked={s.end === true}
                          onChange={(e) => setStep(i, { end: e.target.checked })}
                          className="accent-purple-500"
                        />
                        termina aqui
                      </label>
                    )}
                    <div />
                  </div>
                  <input
                    aria-label={`Etapa ${i + 1}: resposta (aceita {{variavel}})`}
                    value={s.response ?? ''}
                    onChange={(e) => setStep(i, { response: e.target.value })}
                    placeholder="resposta (aceita {{variavel}})"
                    className={inputCls}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      aria-label={`Etapa ${i + 1}: quick replies (separadas por vírgula, máx. 3)`}
                      value={(s.quickReplies ?? []).join(', ')}
                      onChange={(e) =>
                        setStep(i, {
                          quickReplies: e.target.value
                            ? e.target.value
                                .split(',')
                                .map((x) => x.trim())
                                .filter(Boolean)
                            : undefined,
                        })
                      }
                      placeholder="quick replies (separadas por vírgula, máx. 3)"
                      className={inputCls}
                    />
                    <select
                      aria-label={`Etapa ${i + 1}: próxima etapa do fluxo`}
                      value={s.nextStepId ?? ''}
                      onChange={(e) => setStep(i, { nextStepId: e.target.value || null })}
                      className={inputCls}
                      title="Próxima etapa do fluxo"
                    >
                      <option value="" className="bg-[#0D0915]">→ fim do fluxo</option>
                      {(cfg.steps ?? []).map((t, ti) =>
                        t.id !== s.id ? (
                          <option key={ti} value={t.id} className="bg-[#0D0915]">
                            → {t.id || `step-${ti + 1}`}
                          </option>
                        ) : null,
                      )}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addStep} className="mt-2 text-xs text-purple-300 hover:underline">
              + adicionar etapa
            </button>
          </div>

          {/* Variáveis — {{chave}} nas respostas das etapas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-gray-300">Variáveis</p>
              <span className="text-[10px] text-gray-400">use {`{{chave}}`} nas respostas das etapas</span>
            </div>
            <div className="space-y-1.5">
              {Object.entries(cfg.vars ?? {}).map(([k]) => (
                <div key={k} className="grid grid-cols-2 gap-1.5">
                  <input
                    aria-label={`Variável ${k}: chave (renomear)`}
                    value={k}
                    onChange={(e) => renameVar(k, e.target.value)}
                    placeholder="chave"
                    className={inputCls}
                  />
                  <div className="flex gap-1.5">
                    <input
                      aria-label={`Variável ${k}: valor`}
                      value={cfg.vars?.[k] ?? ''}
                      onChange={(e) => setVarValue(k, e.target.value)}
                      placeholder="valor"
                      className={inputCls}
                    />
                    <button onClick={() => delVar(k)} aria-label={`Remover variável ${k}`} className="text-xs text-red-400">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addVar} className="mt-2 text-xs text-purple-300 hover:underline">
              + adicionar variável
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={cfg.useAI === true} onChange={(e) => set({ useAI: e.target.checked })} className="accent-purple-500" />
            Usar IA para mensagens sem regra
          </label>
          {cfg.useAI && (
            <textarea
              rows={2}
              aria-label="System prompt da IA"
              value={cfg.aiSystemPrompt ?? ''}
              onChange={(e) => set({ aiSystemPrompt: e.target.value })}
              placeholder="System prompt da IA"
              className={inputCls}
            />
          )}

          <button
            onClick={() => void save()}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
          >
            {busy ? 'Salvando…' : 'Salvar chatbot'}
          </button>
          {msg && <p role="status" aria-live="polite" className="text-xs text-gray-300">{msg}</p>}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Sem API / Avançado — extração de contatos (declarada)               */
/* ------------------------------------------------------------------ */

function AdvancedExtractionCard() {
  const [params, setParams] = useState({ maxPerHour: '50', note: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setMsg(null);
    try {
      const r = await fetch('/api/integrations/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'qr_whatsapp',
          value: { maxPerHour: Number(params.maxPerHour) || 0 },
        }),
      });
      if (r.ok) setMsg('Parâmetro guardado localmente. A execução (scraping/QR) é não-oficial e sob sua responsabilidade — ainda não há executor no produto.');
      else if (r.status === 401) setMsg('Somente admin/owner configura.');
      else setMsg(`Falha ao guardar (HTTP ${r.status}).`);
    } catch {
      setMsg('Falha de rede ao guardar.');
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <CardHeader title="Extração de contatos" badge="semapi" />
      </div>
      <RiskBanner>
        Métodos &quot;Sem API / Avançado&quot; (leitura de grupos, conversas não salvas,
        QR Code de login, scraping de seguidores) violam os Termos de Uso das plataformas e
        podem resultar em banimento do número/perfil e em violações de LGPD. O produto declara
        o método, guarda apenas o parâmetro e não executa a coleta em silêncio. Use por sua
        conta e risco.
      </RiskBanner>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <label className="block text-xs text-gray-400">
          Limite (msg/h) sugerido
          <input value={params.maxPerHour} onChange={(e) => setParams((p) => ({ ...p, maxPerHour: e.target.value }))} className={inputCls} />
        </label>
        <button onClick={() => void save()} className="self-end px-3 py-2 text-xs font-semibold rounded-lg border border-amber-400/30 text-amber-300 hover:bg-amber-400/10">
          Guardar parâmetro
        </button>
      </div>
      {msg && <p role="status" aria-live="polite" className="mt-2 text-xs text-gray-400">{msg}</p>}
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

function CardHeader({ title, badge }: { title: string; badge: 'API Oficial' | 'semapi' }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-bold text-gray-200">{title}</h2>
      {badge === 'API Oficial' ? (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> API Oficial
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30"
          title="Método não oficial — use por sua conta e risco"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Sem API · Avançado
        </span>
      )}
    </div>
  );
}
