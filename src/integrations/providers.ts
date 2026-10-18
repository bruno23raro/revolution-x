// FASE 1 — Registry de provedores do Hub de Integrações + health probes honestos.
//
// Cada provedor declara:
//   • camada: "API Oficial" (oficial) vs "Sem API / Avançado" (sem_api);
//   • campos de configuração: o que o formulário "Integrar" renderiza;
//   • como sondar o estado (endpoint / apenas chaves / nenhum — ex.: OAuth Meta).
//
// "Sem API / Avançado" (scrapers, QR Code, browser automation) NUNCA executa
// automação evasiva aqui: apenas declara o método, os campos e um AVISO DE RISCO
// (ToS/privacidade/LGPD). A execução real é não-oficial e sob responsabilidade do
// usuário — o hub apenas documenta e deixa configurável, sem executar em silêncio.

export type Layer = 'official' | 'sem_api';

export interface ProviderFieldDef {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  placeholder?: string;
}

export type ProbeKind = 'endpoint' | 'keys' | 'none';

export interface ProviderDef {
  id: string;
  name: string;
  layer: Layer;
  summary: string;
  /** Para "Sem API / Avançado": aviso de risco (ToS / privacidade / LGPD). */
  riskNote?: string;
  /** Campos do formulário "Integrar". Vazio = gerido por outro fluxo (ex.: OAuth Meta). */
  fields: ProviderFieldDef[];
  /** Como sondar o estado. `endpoint` faz um GET real; `keys` só valida presença; `none` não sonda. */
  probe?: ProbeKind;
  /** Campo (no config) que guarda a URL base para o probe. */
  endpointField?: string;
  /** Campo que guarda a credencial a enviar como header no probe. */
  authField?: string;
  /** Header em que a credencial é enviada no probe. */
  authHeader?: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const PROVIDERS: ProviderDef[] = [
  // ===== API Oficial =====
  {
    id: 'meta',
    name: 'Meta (Facebook + Instagram + WhatsApp)',
    layer: 'official',
    summary:
      'Conexão única via OAuth da Meta que habilita Facebook, Instagram e o WhatsApp Business. O token de acesso fica criptografado no banco (AES-256-GCM).',
    fields: [],
    probe: 'none',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    layer: 'official',
    summary: 'Publicação e agendamento via API oficial — usa a conexão Meta (OAuth).',
    fields: [],
    probe: 'none',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    layer: 'official',
    summary: 'Publicação, agendamento e anúncios via API oficial — usa a conexão Meta (OAuth).',
    fields: [],
    probe: 'none',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    layer: 'official',
    summary:
      'Disparo em massa, templates e chatbot via Cloud API oficial — usa a conexão Meta (OAuth).',
    fields: [],
    probe: 'none',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    layer: 'official',
    summary:
      'Agendamento de vídeos e tracking via API oficial do TikTok (client key/secret + token de usuário).',
    fields: [
      { key: 'clientKey', label: 'Client Key', required: true },
      { key: 'clientSecret', label: 'Client Secret', secret: true, required: true },
      { key: 'accessToken', label: 'Access Token (usuário)', secret: true },
    ],
    probe: 'keys',
  },
  {
    id: 'n8n',
    name: 'n8n',
    layer: 'official',
    summary: 'Webhooks de saída/entrada e disparo de workflows do n8n (instância própria ou nuvem).',
    fields: [
      { key: 'baseUrl', label: 'URL base da instância', required: true, placeholder: 'https://n8n.suaempresa.com' },
      { key: 'apiKey', label: 'API Key (X-Api-Key)', secret: true },
    ],
    probe: 'endpoint',
    endpointField: 'baseUrl',
    authField: 'apiKey',
    authHeader: 'X-Api-Key',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    layer: 'official',
    summary: 'Catch Hook / webhooks para disparar Zaps e receber eventos.',
    fields: [
      { key: 'webhookUrl', label: 'URL do Catch Hook / Webhook', required: true, placeholder: 'https://hooks.zapier.com/...' },
      { key: 'apiKey', label: 'API Key', secret: true },
    ],
    probe: 'endpoint',
    endpointField: 'webhookUrl',
    authField: 'apiKey',
    authHeader: 'Authorization',
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    layer: 'official',
    summary: 'Webhooks de entrada/saída para cenários Make.',
    fields: [
      { key: 'webhookUrl', label: 'URL do Webhook', required: true, placeholder: 'https://hook.make.com/...' },
      { key: 'hmacKey', label: 'HMAC Key', secret: true },
    ],
    probe: 'endpoint',
    endpointField: 'webhookUrl',
  },
  {
    id: 'resend',
    name: 'Resend (e-mail)',
    layer: 'official',
    summary: 'Envio de e-mail transacional (confirmado na Fase 1 como credencial configurável).',
    fields: [
      { key: 'apiKey', label: 'API Key', secret: true, required: true, placeholder: 're_...' },
      { key: 'fromEmail', label: 'Remetente (from)', placeholder: 'contato@suaempresa.com' },
    ],
    probe: 'keys',
  },
  {
    id: 'webhook_inbound',
    name: 'Webhook de entrada (n8n/Zapier/Make)',
    layer: 'official',
    summary:
      'Segredo compartilhado que autoriza eventos recebidos de sua automação (endpoint /api/webhooks/inbound).',
    fields: [{ key: 'secret', label: 'Secret compartilhado', secret: true, required: true }],
    probe: 'keys',
  },

  // ===== Sem API / Avançado =====
  {
    id: 'scraper_instagram',
    name: 'Instagram (scraping / sem API)',
    layer: 'sem_api',
    summary: 'Coleta de seguidores, fotos e extração de WhatsApp por scraping de página.',
    riskNote:
      'Viola os Termos de Uso do Instagram e pode violar LGPD/GDPR (dados pessoais). Risco real de bloqueio/perda da conta e responsabilização legal. Use apenas sobre dados a que você tem direito, sob a sua responsabilidade.',
    fields: [{ key: 'proxy', label: 'Proxy (opcional)' }],
    probe: 'none',
  },
  {
    id: 'qr_whatsapp',
    name: 'WhatsApp (QR Code / sem API)',
    layer: 'sem_api',
    summary: 'Bridge não oficial via WhatsApp Web para enviar sem a API oficial da Meta.',
    riskNote:
      'Método não oficial — viola os ToS da Meta e pode banir o número. A sessão fica no navegador; proteja o token. Use em conta de sacrifício, nunca na principal.',
    fields: [{ key: 'sessionId', label: 'ID da sessão (gateway)' }],
    probe: 'none',
  },
  {
    id: 'scraper_tiktok',
    name: 'TikTok (scraping / sem API)',
    layer: 'sem_api',
    summary: 'Coleta de seguidores e vídeos por scraping, sem a API oficial.',
    riskNote:
      'Viola os ToS do TikTok e pode violar LGPD/GDPR. Risco de bloqueio de IP/conta. Uso sob sua responsabilidade.',
    fields: [{ key: 'proxy', label: 'Proxy (opcional)' }],
    probe: 'none',
  },
  {
    id: 'browser_automation',
    name: 'Automação de navegador',
    layer: 'sem_api',
    summary: 'Navegador controlado para interações que a API oficial não expõe (curtir, seguir, comentar em lote).',
    riskNote:
      'Automação em massa não-oficial: pode violar ToS das plataformas, disparar bloqueios e criar risco legal. Ative com moderação e com contas de baixo risco.',
    fields: [{ key: 'maxPerHour', label: 'Limite de ações/hora' }],
    probe: 'none',
  },
];

export function providerById(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function providersByLayer(layer: Layer): ProviderDef[] {
  return PROVIDERS.filter((p) => p.layer === layer);
}

// ---------------------------------------------------------------------------
// Health probe (injetável: fetchImpl + timeout → testável sem rede)
// ---------------------------------------------------------------------------

export type ProbeStatus = 'ok' | 'error' | 'not_configured' | 'skipped';

export interface ProbeResult {
  provider: string;
  status: ProbeStatus;
  detail?: string;
}

export interface ProbeOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Sonda um provedor conforme seu `probe`. Nunca lança; retorna um resultado
 * honesto (`not_configured` / `ok` / `error` / `skipped`).
 */
export async function probeProvider(
  def: ProviderDef,
  value: Record<string, unknown> | null,
  opts: ProbeOptions = {},
): Promise<ProbeResult> {
  const fetchImpl = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const timeoutMs = opts.timeoutMs ?? 5000;

  // Não configurado / sem o campo essencial.
  if (!value) return { provider: def.id, status: 'not_configured' };
  if (def.probe === 'endpoint' && def.endpointField) {
    const url = String(value[def.endpointField] ?? '');
    if (!url) return { provider: def.id, status: 'not_configured', detail: `${def.endpointField} ausente` };
    if (!fetchImpl) return { provider: def.id, status: 'skipped', detail: 'probe indisponível neste ambiente' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {};
      if (def.authField && def.authHeader && value[def.authField]) {
        headers[def.authHeader] = String(value[def.authField]);
      }
      const res = await fetchImpl(url, { method: 'GET', headers, signal: ctrl.signal });
      return { provider: def.id, status: res.ok ? 'ok' : 'error', detail: `HTTP ${res.status}` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { provider: def.id, status: 'error', detail: msg === 'AbortError' ? `timeout ${timeoutMs}ms` : msg };
    } finally {
      clearTimeout(timer);
    }
  }

  if (def.probe === 'keys') {
    const missing = def.fields.filter((f) => f.required && !value[f.key]);
    if (missing.length > 0) {
      return { provider: def.id, status: 'not_configured', detail: `faltando: ${missing.map((f) => f.key).join(', ')}` };
    }
    return { provider: def.id, status: 'ok', detail: 'configurado (verificação remota não disponível)' };
  }

  // probe 'none' / undefined (OAuth Meta, sem API): não sonda remotamente.
  if (def.layer === 'sem_api') {
    return { provider: def.id, status: 'skipped', detail: 'método sem API — sem verificação remota' };
  }
  return { provider: def.id, status: 'skipped', detail: 'gerenciado via OAuth da Meta' };
}

/** Sonda vários provedores de uma vez, em paralelo (falha de um não derruba os outros). */
export async function probeMany(
  defs: ProviderDef[],
  values: Record<string, Record<string, unknown> | null>,
  opts: ProbeOptions = {},
): Promise<ProbeResult[]> {
  const settled = await Promise.all(defs.map((def) => probeProvider(def, values[def.id] ?? null, opts)));
  return settled;
}
