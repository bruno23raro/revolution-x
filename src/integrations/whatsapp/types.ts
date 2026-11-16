// WhatsApp oficial — contratos da factory (IWhatsAppProvider).
//
// Convenções da casa (mesmas de meta/capi.ts e outboundExecutors.ts):
//  * adapters NUNCA lançam — sempre `{ok, error, errorDetail}`;
//  * `fetchImpl` injetável com fallback ao env em toda função de rede;
//  * segredos (api-key OpenBSP, access_token) só server-side, via env/DB cifrado.
//
// Fonte do contrato OpenBSP: docs/RX_OPENBSP_CONTRACT_SUMMARY.md
// (open-bsp-api/INTEGRATING.md + AUTH.md, lidos em 2026-10-29).

export type ProviderName = 'openbsp' | 'meta_direct';

/** Credenciais do canal já decifradas (a rota resolve; o adapter não lê DB). */
export interface ChannelAccess {
  /** access_token do WABA (plaintext, já decifrado pela rota). */
  accessToken: string;
  /** organizations_addresses.address / Meta phone_number_id. */
  phoneNumberId: string;
  wabaId?: string | null;
}

export type OfficialSendError =
  | 'openbsp_not_configured'
  | 'meta_direct_reserved'
  | 'channel_unavailable'
  | 'fetch_unavailable'
  | 'http_error'
  | 'network_error'
  | 'provider_error'
  | 'invalid_message'
  | 'tier_limit_reached'
  | 'meta_not_configured';

export interface OfficialSendResult {
  ok: boolean;
  /** id externo da mensagem (wamid Meta ou uuid da linha OpenBSP). */
  messageId?: string;
  /** caminho usado — auditoria honesta de QUAL trilha enviou. */
  via?: 'meta_direct' | 'openbsp';
  error?: OfficialSendError;
  /** código de erro do provedor (ex.: Meta 131047) quando houver. */
  errorCode?: string | number;
  errorDetail?: string;
}

export interface TemplateComponent {
  type: string; // 'BODY' | 'HEADER' | 'BUTTONS' | ...
  [key: string]: unknown;
}

export interface OfficialTemplateSpec {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string; // ex. 'pt_BR'
  /** Corpo com placeholders {{1}}, {{2}}... (mesma forma do adapter da casa). */
  body: string;
}

export interface OfficialTemplateInfo {
  name: string;
  language?: string;
  category?: string;
  /** PENDING | APPROVED | REJECTED | PAUSED | DISABLED */
  status?: string;
  rejectionReason?: string;
  rejection_reason?: string;
  components?: Array<{
    type: string;
    text?: string;
    format?: string;
    buttons?: Array<{ type: string; text: string; sub_type?: string; url?: string }>;
    parameters?: Array<{ type: string; text: string }>;
  }>;
  quality_score?: number;
}

export interface ProviderCallOpts {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** AbortController externo — aborta o fetch em voo (timeout global da conexão). */
  signal?: AbortSignal;
  language?: string;
}

export interface TemplateOpResult {
  ok: boolean;
  error?: OfficialSendError;
  errorDetail?: string;
  /** Nome do template criado (quando ok=true). */
  name?: string;
  /** ID do template criado no provedor (quando ok=true). */
  templateId?: string;
}

export interface ListTemplatesResult extends TemplateOpResult {
  templates: OfficialTemplateInfo[];
}

/** Payload de disparo: texto livre OU template APROVADO (gate 2). */
export type DispatchPayload =
  | { kind: 'text'; text: string }
  | { kind: 'template'; name: string; language: string; variables: string[] };

export interface IWhatsAppProvider {
  readonly name: ProviderName;
  send(access: ChannelAccess, to: string, payload: DispatchPayload, opts?: ProviderCallOpts): Promise<OfficialSendResult>;
  /** Envia mensagem interativa com botões de resposta rápida (quick replies). */
  sendButton?(access: ChannelAccess, to: string, body: string, buttons: string[], opts?: ProviderCallOpts): Promise<OfficialSendResult>;
  /** Envio em massa com delay entre envios. */
  runMassSend?(access: ChannelAccess, recipients: Array<{ to: string; text?: string }>, opts?: ProviderCallOpts & { delayMs?: number; template?: { name: string; variables: string[]; language?: string } }): Promise<{ total: number; sent: number; failed: number; results: OfficialSendResult[] }>;
  createTemplate(access: ChannelAccess, spec: OfficialTemplateSpec, opts?: ProviderCallOpts): Promise<TemplateOpResult>;
  listTemplates(access: ChannelAccess, opts?: ProviderCallOpts): Promise<ListTemplatesResult>;
  getTemplateStatus(access: ChannelAccess, name: string, language: string, opts?: ProviderCallOpts): Promise<TemplateOpResult & { template?: OfficialTemplateInfo }>;
  /** Envia mensagem de teste de template. */
  sendTestMessage?(access: ChannelAccess, templateName: string, to: string, variables?: string[], opts?: ProviderCallOpts): Promise<{ ok: boolean; messageId?: string; error?: OfficialSendError; errorDetail?: string }>;
}
