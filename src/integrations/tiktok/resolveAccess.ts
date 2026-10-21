// FASE 2 · slice 3 — Resolve a credencial do TikTok de um tenant para
// publicar/trackear via Content Posting API oficial.
//
// Diferente dos resolvers da Meta (que leem a tabela Supabase
// `meta_integrations` via service_role), o TikTok mora em AgentMemory
// (Prisma, RLS de tenant/usuário) — o MESMO armazenamento dos outros
// provedores do Hub de Integrações (n8n, Zapier, ...). O segredo (token) vive
// SÓ no banco, nunca no front-end. `client` (PrismaClient) e `scope`
// ({organizationId, userId}) são argumentos, então isto é testável sem rede
// nem banco.
//
// Se a fila/memória não está disponível (tabela não migrada no ambiente),
// `listMemory` lança `TaskQueueUnavailableError` — o chamador (rota) decide
// degradar (503). Não capturamos aqui para não mascarar o erro.

import type { PrismaClient, Prisma } from '@prisma/client';
import type { OrgScope } from '@/lib/taskQueue';
import { listMemory, saveMemory, TaskQueueUnavailableError } from '@/lib/taskQueue';
import { providerConfigKey } from '@/integrations/configStore';
import { appendPendingTikTokPost } from './tiktokPublisher';
import type { TikTokAccess, PendingTikTokPost } from './tiktokPublisher';
import type { TikTokAdsAccess } from './adsAnalytics';
import type { TikTokTokenSet } from './auth/oauth';
import { decryptToken } from '@/lib/encryption';

const PROVIDER = 'tiktok';
export const PENDING_KEY = 'pending:tiktok_posts';

export type ResolveTikTokReason =
  | 'not_connected'
  | 'no_token'
  | 'decrypt_failed'
  | 'queue_unavailable'
  | 'account_not_found';

/** Identificador de uma conta TikTok para seleção explícita (openId). */
export type TikTokAccountRef = string;

/**
 * Descrição pública de uma conta TikTok conectada — NUNCA carrega segredos
 * (access/refresh token), só metadados para o seletor de contas na UI.
 */
export interface TikTokAccountInfo {
  openId: string;
  source: 'oauth' | 'manual' | 'unknown';
  obtainedAt: string;
  tokenExpired: boolean;
}

/** Estado persistido do OAuth do TikTok (quando o token veio do callback). */
export interface TikTokOAuthState {
  accessToken: string;
  refreshToken: string;
  openId: string;
  scope: string;
  expiresIn: number;
  refreshExpiresIn: number;
  obtainedAt: string;
}

export type ResolveTikTokResult =
  | {
      ok: true;
      access: TikTokAccess;
      /** Presença de clientKey/clientSecret (necessária para OAUTH). */
      hasClientKey: boolean;
      hasClientSecret: boolean;
      /** Token OAuth (access+refresh+openId) quando o tenant conectou via OAuth. */
      oauth: TikTokOAuthState | null;
      /** access token expirou? (só relevante quando oauth != null). */
      tokenExpired: boolean;
      /**
       * MULTICONTAS — a conta efetivamente resolvida. `openId` vazio para o
       * cadastro legado/manual de conta única. `accountCount` é o total de
       * contas conectadas no tenant (para o seletor da UI). Opcional por
       * compatibilidade: mocks de conta única podem omitir; o resolver sempre
       * preenche.
       */
      selectedAccount?: { openId: string; source: 'oauth' | 'manual' | 'unknown' };
      accountCount?: number;
    }
  | { ok: false; reason: ResolveTikTokReason };

/**
 * Lê a config `tiktok` em AgentMemory e devolve o `TikTokAccess` pronto para
 * o publicador. Não altera outros resolvers. Não lança `TaskQueueUnavailableError`
 * (propaga para a rota).
 */
/** Conta candidata (forma bruta — `accessToken` em texto puro OU ciphertext). */
interface TikTokCandidate {
  openId: string;
  source: 'oauth' | 'manual' | 'unknown';
  /** Texto puro (cadastro manual) OU ciphertext AES-256-GCM (OAuth). */
  accessToken: string;
  oauth: TikTokOAuthState | null;
  obtainedAt: string;
}

/** Monta a lista de contas a partir do valor persistido (multi ou legado). */
function collectTikTokAccounts(cfg: Record<string, unknown>): TikTokCandidate[] {
  const rawAccounts = cfg.accounts;
  if (Array.isArray(rawAccounts)) {
    return rawAccounts
      .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === 'object')
      .map((a) => {
        const oauth = readOAuthState(a);
        const accessToken = typeof a.accessToken === 'string' ? a.accessToken : '';
        const source: TikTokCandidate['source'] = oauth
          ? 'oauth'
          : accessToken
            ? 'manual'
            : 'unknown';
        const openId =
          typeof a.openId === 'string' && a.openId
            ? a.openId
            : oauth?.openId ?? '';
        const obtainedAt =
          typeof a.obtainedAt === 'string' && a.obtainedAt
            ? a.obtainedAt
            : oauth?.obtainedAt ?? '';
        return { openId, source, accessToken, oauth, obtainedAt };
      })
      .filter((c) => c.source !== 'unknown');
  }

  // Forma legado/manual de conta única: accessToken (topo) + oauthTokenSet.
  const legacy = readOAuthState(cfg);
  const accessToken = typeof cfg.accessToken === 'string' ? cfg.accessToken : '';
  if (legacy || accessToken) {
    const source: TikTokCandidate['source'] = legacy ? 'oauth' : 'manual';
    return [
      {
        openId: legacy?.openId ?? '',
        source,
        accessToken: accessToken || legacy!.accessToken,
        oauth: legacy,
        obtainedAt: legacy?.obtainedAt ?? '',
      },
    ];
  }
  return [];
}

export async function resolveTenantTikTokAccess(
  client: PrismaClient,
  scope: OrgScope,
  account?: TikTokAccountRef,
): Promise<ResolveTikTokResult> {
  let mems: Awaited<ReturnType<typeof listMemory>>;
  try {
    mems = await listMemory(client, scope);
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) return { ok: false, reason: 'queue_unavailable' };
    throw e;
  }
  const hit = mems.find((m) => m.key === `integration:${PROVIDER}`);
  if (!hit) return { ok: false, reason: 'not_connected' };

  const cfg = (hit.value ?? {}) as Record<string, unknown>;
  const candidates = collectTikTokAccounts(cfg);
  if (candidates.length === 0) return { ok: false, reason: 'no_token' };

  const hasClientKey = typeof cfg.clientKey === 'string' && cfg.clientKey.length > 0;
  const hasClientSecret = typeof cfg.clientSecret === 'string' && cfg.clientSecret.length > 0;

  // Seleção: explícita por openId (o próprio identificador da conta; '0','1'
  // não são índices — são valores que precisariam ser openId literais).
  // 'default' vazio força a escolha determinística: a conta mais recente
  // (obtainedAt), tie-break = última. Referência desconhecida → account_not_found.
  // (A seleção por ÍNDICE existe só em saveTikTokOAuthTokens, para upsert
  // por posição quando openId está ausente.)
  let chosen: TikTokCandidate | undefined;
  const ref = (account ?? '').trim();
  if (ref) {
    chosen =
      ref === 'default'
        ? undefined
        : candidates.find((c) => c.openId && c.openId === ref);
    if (ref !== 'default' && !chosen) return { ok: false, reason: 'account_not_found' };
  }
  if (!chosen) {
    chosen = candidates.reduce<TikTokCandidate | undefined>((acc, c) => {
      if (!acc) return c;
      const aT = Date.parse(acc.obtainedAt);
      const cT = Date.parse(c.obtainedAt);
      if (!Number.isNaN(cT) && (Number.isNaN(aT) || cT >= aT)) return c;
      return acc;
    }, undefined);
    if (!chosen) return { ok: false, reason: 'no_token' };
  }

  const tokenExpired = chosen.oauth ? isTikTokTokenExpired(chosen.oauth) : false;
  let accessToken: string;
  if (chosen.oauth) {
    try {
      accessToken = decryptToken(chosen.oauth.accessToken);
    } catch {
      return { ok: false, reason: 'decrypt_failed' };
    }
  } else {
    accessToken = chosen.accessToken.trim();
    if (!accessToken) return { ok: false, reason: 'no_token' };
  }

  const access: TikTokAccess = { accessToken };
  return {
    ok: true,
    access,
    hasClientKey,
    hasClientSecret,
    oauth: chosen.oauth,
    tokenExpired,
    selectedAccount: { openId: chosen.openId, source: chosen.source },
    accountCount: candidates.length,
  };
}

/** Lista (somente metadados, sem segredo) as contas TikTok conectadas. */
export async function listTikTokAccounts(
  client: PrismaClient,
  scope: OrgScope,
): Promise<TikTokAccountInfo[]> {
  let mems: Awaited<ReturnType<typeof listMemory>>;
  try {
    mems = await listMemory(client, scope);
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) return [];
    throw e;
  }
  const hit = mems.find((m) => m.key === `integration:${PROVIDER}`);
  if (!hit) return [];
  const cfg = (hit.value ?? {}) as Record<string, unknown>;
  return collectTikTokAccounts(cfg).map((c) => ({
    openId: c.openId,
    source: c.source,
    obtainedAt: c.obtainedAt,
    tokenExpired: c.oauth ? isTikTokTokenExpired(c.oauth) : false,
  }));
}

/** Lê o bloco `oauthTokenSet` persistido pelo callback OAuth do TikTok. */
function readOAuthState(cfg: Record<string, unknown>): TikTokOAuthState | null {
  const o = cfg.oauthTokenSet;
  if (!o || typeof o !== 'object') return null;
  const v = o as Record<string, unknown>;
  if (typeof v.accessToken !== 'string' || typeof v.refreshToken !== 'string') return null;
  return {
    accessToken: String(v.accessToken),
    refreshToken: String(v.refreshToken),
    openId: typeof v.openId === 'string' ? String(v.openId) : '',
    scope: typeof v.scope === 'string' ? String(v.scope) : '',
    expiresIn: typeof v.expiresIn === 'number' ? v.expiresIn : 0,
    refreshExpiresIn: typeof v.refreshExpiresIn === 'number' ? v.refreshExpiresIn : 0,
    obtainedAt: typeof v.obtainedAt === 'string' ? String(v.obtainedAt) : '',
  };
}

/** O access token expirou? (expira em 24h; refresh em 365 dias). */
export function isTikTokTokenExpired(oauth: TikTokOAuthState): boolean {
  if (!oauth.obtainedAt || !oauth.expiresIn) return false; // sem info, não assume expirado
  const obtained = Date.parse(oauth.obtainedAt);
  if (Number.isNaN(obtained)) return false;
  return Date.now() - obtained >= oauth.expiresIn * 1000;
}

/**
 * Persiste o conjunto de tokens do OAuth do TikTok (access + refresh + openId)
 * no AgentMemory do tenant, sob o MESMO key `integration:tiktok` do cadastro
 * manual. O access token é criptografado (AES-256-GCM) antes de gravar — o
 * segredo nunca entra no banco em texto puro.
 *
 * MULTICONTAS: acrescenta/atualiza a conta (por `openId`) no array
 * `accounts[]` PRESERVANDO as demais contas já conectadas — nunca sobrepõe
 * outra conta. Também mantém os campos de topo (legado: `accessToken` +
 * `oauthTokenSet`) apontando para a conta mais recente, para compatibilidade
 * com leitores de conta única. `opts.accountIndex` (0-based) atualiza uma
 * entrada específica por índice quando `openId` está ausente.
 */
export async function saveTikTokOAuthTokens(
  client: PrismaClient,
  scope: OrgScope,
  tokens: TikTokTokenSet,
  encrypted: string,
  opts?: { accountIndex?: number },
): Promise<void> {
  const mems = await listMemory(client, scope);
  const hit = mems.find((m) => m.key === `integration:${PROVIDER}`);
  const base = (hit?.value ?? {}) as Record<string, unknown>;

  const oauthSet = {
    accessToken: encrypted,
    refreshToken: tokens.refreshToken,
    openId: tokens.openId,
    scope: tokens.scope,
    expiresIn: tokens.expiresIn,
    refreshExpiresIn: tokens.refreshExpiresIn,
    obtainedAt: new Date().toISOString(),
  } as const;

  const accounts = Array.isArray(base.accounts)
    ? (base.accounts as unknown as Array<Record<string, unknown>>).map((a) => ({ ...a }))
    : [];

  const openId = String(tokens.openId ?? '');
  const entry: Record<string, unknown> = {
    openId: openId || undefined,
    source: 'oauth',
    accessToken: encrypted,
    oauthTokenSet: oauthSet,
    obtainedAt: oauthSet.obtainedAt,
  };

  let idx = -1;
  if (openId) idx = accounts.findIndex((a) => a.openId === openId);
  if (idx < 0 && typeof opts?.accountIndex === 'number' && opts.accountIndex >= 0) {
    idx = opts.accountIndex < accounts.length ? opts.accountIndex : accounts.length;
  }
  if (idx >= 0) accounts[idx] = { ...accounts[idx], ...entry };
  else accounts.push(entry);

  const next: Record<string, unknown> = {
    ...base,
    accounts,
    // Legado: aponta para a conta mais recente (a que acabou de salvar).
    accessToken: encrypted,
    oauthTokenSet: oauthSet,
  };
  await saveMemory(client, scope, 'preference', `integration:${PROVIDER}`, next as Prisma.JsonValue);
}

// ---------------------------------------------------------------------------
// Fila persistente de agendamento (intenção) — a API oficial não tem horário.
// ---------------------------------------------------------------------------

/** Lê a fila atual de posts pendentes (vazia se ausente). */
export async function listPendingTikTokPosts(
  client: PrismaClient,
  scope: OrgScope,
): Promise<PendingTikTokPost[]> {
  const mems = await listMemory(client, scope);
  const hit = mems.find((m) => m.key === PENDING_KEY);
  if (!hit) return [];
  const value = hit.value;
  return Array.isArray(value) ? (value as unknown as PendingTikTokPost[]) : [];
}

/** Acrescenta uma intenção na fila (upsert no mesmo key de AgentMemory). */
export async function addPendingTikTokPost(
  client: PrismaClient,
  scope: OrgScope,
  item: PendingTikTokPost,
): Promise<void> {
  const current = await listPendingTikTokPosts(client, scope);
  const next = appendPendingTikTokPost(current, item);
  await saveMemory(client, scope, 'preference', PENDING_KEY, next as unknown as Prisma.JsonValue);
}

// ---------------------------------------------------------------------------
// FASE 3 · slice 1 — Ads: resolve a credencial do TikTok BUSINESS (BAP) para
// relatórios do Gerenciador de Anúncios. Provider `tiktok_ads` no
// AgentMemory: `advertiserId` (público) + `accessToken` (segredo, BAP).
// ---------------------------------------------------------------------------

export type ResolveTikTokAdsReason =
  | 'not_connected'
  | 'no_token'
  | 'no_advertiser'
  | 'queue_unavailable';

export type ResolveTikTokAdsResult =
  | { ok: true; access: TikTokAdsAccess }
  | { ok: false; reason: ResolveTikTokAdsReason };

/**
 * Lê a config `tiktok_ads` em AgentMemory e devolve o `TikTokAdsAccess`
 * pronto para o report de anúncios. Mesma captura de
 * `TaskQueueUnavailableError` do resolver de publicação (503 na rota).
 */
export async function resolveTenantTikTokAdsAccess(
  client: PrismaClient,
  scope: OrgScope,
): Promise<ResolveTikTokAdsResult> {
  let mems: Awaited<ReturnType<typeof listMemory>>;
  try {
    mems = await listMemory(client, scope);
  } catch (e) {
    if (e instanceof TaskQueueUnavailableError) return { ok: false, reason: 'queue_unavailable' };
    throw e;
  }
  const hit = mems.find((m) => m.key === providerConfigKey('tiktok_ads'));
  if (!hit) return { ok: false, reason: 'not_connected' };

  const cfg = (hit.value ?? {}) as Record<string, unknown>;
  const accessToken = typeof cfg.accessToken === 'string' ? cfg.accessToken.trim() : '';
  if (!accessToken) return { ok: false, reason: 'no_token' };

  const advertiserId = typeof cfg.advertiserId === 'string' ? cfg.advertiserId.trim() : '';
  if (!advertiserId) return { ok: false, reason: 'no_advertiser' };

  const access: TikTokAdsAccess = { accessToken, advertiserId };
  return { ok: true, access };
}
