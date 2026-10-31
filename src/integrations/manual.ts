// Serviço de integrações MANUAIS (sem API) — modo MANUAL da tabela integrations (021).
//
// Regras:
//  * Multi-conta: a UNIQUE (user_id, channel, meta_account_id) da 018 já permite
//    N contas por usuário; para WhatsApp MANUAL geramos meta_account_id sintético
//    (wamanual-<uuid8>) e aplicamos o limite de 5 canais por usuário.
//  * A credencial (cookie de sessão / access token manual) é cifrada com
//    AES-256-GCM (src/lib/encryption.ts) antes de gravar em access_token.
//  * Verificação é honesta: sonda a plataforma quando há endpoint possível;
//    WhatsApp manual NÃO tem sonda — status fica PENDING até verify dizer outra coisa.
//  * Nunca logamos a credencial (mascarada via riskLogger/mask pattern).

import { randomUUID } from 'crypto';
import { encryptToken } from '@/lib/encryption';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const MANUAL_MODE = 'MANUAL' as const;
export const OFFICIAL_MODE = 'OFFICIAL' as const;

export type ManualChannel = 'instagram' | 'facebook' | 'whatsapp';
export const MANUAL_CHANNELS: ManualChannel[] = ['instagram', 'facebook', 'whatsapp'];

export const MANUAL_WHATSAPP_MAX = 5;

export type CredentialKind = 'token' | 'cookie';

export interface ConnectManualInput {
  userId: string;
  channel: ManualChannel;
  credential: string;
  kind?: CredentialKind;
  label?: string;
}

export type VerifyOutcome =
  | { valid: true; detail?: string }
  | { valid: false; reason: 'invalid_credential' | 'platform_rejected' | 'verify_unavailable'; detail?: string };

/**
 * Curta a credencial manual contra a plataforma.
 * - instagram/facebook: o payload é um access token de long-lived (Graph API);
 *   sondamos GET graph.facebook.com/debug_token.
 * - whatsapp: cookie de sessão do WhatsApp Web — sem endpoint de validação;
 *   devolve 'verify_unavailable' (honesto: a plataforma não confirma aqui).
 * fetchImpl injetável para teste sem rede.
 */
export async function verifyManualCredential(
  channel: ManualChannel,
  credential: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000,
  kind: CredentialKind = 'token',
): Promise<VerifyOutcome> {
  if (!credential || credential.trim().length < 20) {
    return { valid: false, reason: 'invalid_credential', detail: 'credencial muito curta' };
  }
  if (channel === 'whatsapp' || kind === 'cookie') {
    // shortcut: não existe endpoint público para validar cookie de sessão
    // (WhatsApp Web / sessionid do IG); upgrade quando o gateway QR (EVO/Baileys)
    // expuser /client/:id/connectionState ou quando houver probe autenticado estável.
    return { valid: false, reason: 'verify_unavailable', detail: 'credencial de sessão não possui verificação remota' };
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return { valid: false, reason: 'verify_unavailable', detail: 'META_APP_ID/SECRET ausentes no servidor' };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(
      `https://graph.facebook.com/v26.0/debug_token?input_token=${encodeURIComponent(credential.trim())}` +
        `&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`,
      { signal: ctrl.signal },
    );
    if (!res.ok) return { valid: false, reason: 'platform_rejected', detail: `HTTP ${res.status}` };
    const data = (await res.json()) as { data?: { is_valid?: boolean } };
    if (data.data?.is_valid) return { valid: true, detail: 'token válido na Graph API' };
    return { valid: false, reason: 'platform_rejected', detail: 'token inválido/expirado' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { valid: false, reason: 'verify_unavailable', detail: msg };
  } finally {
    clearTimeout(timer);
  }
}

export interface ManualAccountRow {
  id: string;
  channel: string;
  status: string;
  metaAccountId: string | null;
  label: string | null;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
}

/** Lista contas MANUAis do usuário (nunca retorna tokens). */
export async function listManualAccounts(userId: string): Promise<ManualAccountRow[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('integrations')
    .select('id, channel, status, meta_account_id, metadata, created_at, updated_at, last_error')
    .eq('user_id', userId)
    .eq('mode', MANUAL_MODE)
    .neq('status', 'DISCONNECTED')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listManualAccounts: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    channel: r.channel as string,
    status: r.status as string,
    metaAccountId: (r.meta_account_id as string | null) ?? null,
    label: ((r.metadata as Record<string, unknown> | null)?.label as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    lastError: (r.last_error as string | null) ?? null,
  }));
}

export type ConnectResult =
  | { ok: true; id: string; status: string; metaAccountId: string }
  | { ok: false; error: 'limit_exceeded' | 'encryption_failed' | 'db_error'; detail?: string };

/**
 * Conecta (ou reconecta) uma conta manual. WhatsApp respeita o teto de 5
 * canais por usuário; Instagram/Facebook permitem N contas (a UNIQUE da 018
 * usa meta_account_id, então uma conta nova = um registro novo).
 */
export async function connectManualAccount(
  input: ConnectManualInput,
  verify: (
    channel: ManualChannel,
    credential: string,
    fetchImpl?: typeof fetch,
    timeoutMs?: number,
    kind?: CredentialKind,
  ) => Promise<VerifyOutcome> = verifyManualCredential,
): Promise<ConnectResult> {
  const supabase = createServiceRoleClient();

  if (input.channel === 'whatsapp') {
    const existing = await listManualAccounts(input.userId);
    const waCount = existing.filter((a) => a.channel === 'whatsapp').length;
    if (waCount >= MANUAL_WHATSAPP_MAX) {
      return { ok: false, error: 'limit_exceeded', detail: `Limite de ${MANUAL_WHATSAPP_MAX} canais de WhatsApp manual atingido` };
    }
  }

  let encrypted: string;
  try {
    encrypted = encryptToken(input.credential.trim());
  } catch {
    return { ok: false, error: 'encryption_failed' };
  }

  const kind: CredentialKind = input.kind ?? (input.channel === 'whatsapp' ? 'cookie' : 'token');
  const outcome = await verify(input.channel, input.credential, undefined, undefined, kind);
  const status = outcome.valid ? 'CONNECTED' : outcome.reason === 'invalid_credential' ? 'ERROR' : 'PENDING';
  // meta_account_id sintético e único por conexão → multi-conta garantida pela UNIQUE da 018
  const metaAccountId = `man-${input.channel.slice(0, 4)}-${randomUUID().slice(0, 8)}`;

  const { data, error } = await supabase
    .from('integrations')
    .insert({
      user_id: input.userId,
      channel: input.channel,
      mode: MANUAL_MODE,
      status,
      access_token: encrypted,
      meta_account_id: metaAccountId,
      meta_account_name: input.label?.slice(0, 120) ?? null,
      metadata: { label: input.label?.slice(0, 120) ?? null, method: 'manual', kind, verified: outcome.valid },
      last_error: outcome.valid ? null : (outcome as { detail?: string }).detail ?? outcome.reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: 'db_error', detail: error?.message };
  }
  return { ok: true, id: data.id as string, status, metaAccountId };
}
