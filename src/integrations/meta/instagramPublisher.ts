// FASE 2 — Publicação e agendamento de Instagram via Graph API oficial da Meta.
//
// Fluxo real (2 passos), conforme a documentação oficial do Instagram Graph API:
//   1. `createInstagramMediaContainer` → POST /{ig-user-id}/media
//      (media_type IMAGE/REELS + image_url|video_url + caption + scheduled_start_time)
//      → devolve o `containerId`.
//   2. `publishInstagramMedia` → POST /{ig-user-id}/media_publish?creation_ids=containerId
//      → devolve o `mediaId` (para posts agendados, a Meta publica no horário).
//
// Assim como o sender de WhatsApp (FASE 1), os serviços NÃO lançam: retornam um
// resultado honesto (`ok`/`error`). `fetchImpl` é injetável para testes sem rede.
// `scheduled_start_time` é UNIX em segundos (limite oficial: 10 min a 75 dias).

const DEFAULT_BASE = 'https://graph.facebook.com';
const DEFAULT_VERSION = 'v26.0';

/** 75 dias em segundos — teto oficial de agendamento do Instagram. */
export const MAX_SCHEDULE_AHEAD_SECONDS = 75 * 24 * 60 * 60;

export type IgMediaType = 'IMAGE' | 'REEL';

export interface InstagramAccess {
  accessToken: string;
  /** IG user/business account id (a `instagram_account_id` de meta_integrations). */
  instagramUserId: string;
  apiBase?: string;
  version?: string;
}

export type PubError =
  | 'meta_not_configured'
  | 'fetch_unavailable'
  | 'no_media_source'
  | 'http_error'
  | 'network_error';

export interface CreateMediaSpec {
  /** Padrão: IMAGE. */
  mediaType?: IgMediaType;
  /** URL pública de imagem (para IMAGE ou REEL). */
  imageUrl?: string;
  /** URL pública de vídeo (para REEL). */
  videoUrl?: string;
  caption?: string;
  /** ISO 8601 → vira `scheduled_start_time` (UNIX s). Opcional. */
  scheduledAt?: string;
}

export interface CreateMediaResult {
  ok: boolean;
  containerId?: string;
  error?: PubError;
  errorDetail?: string;
  /** `true` quando foi definido um horário de agendamento. */
  scheduled?: boolean;
}

export interface PublishResult {
  ok: boolean;
  mediaId?: string;
  containerId?: string;
  error?: PubError;
  errorDetail?: string;
}

export interface PubOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  apiBase?: string;
  version?: string;
  /** Torna `now` injetável para validar a janela de agendamento em testes. */
  nowMs?: number;
}

function baseFor(opts: PubOptions, access: InstagramAccess): string {
  const base = (opts.apiBase ?? access.apiBase ?? DEFAULT_BASE).replace(/\/+$/, '');
  const version = opts.version ?? access.version ?? DEFAULT_VERSION;
  return `${base}/${version}`;
}

function resolveFetch(opts: PubOptions): typeof fetch | undefined {
  return opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
}

function hasSource(spec: CreateMediaSpec, mediaType: IgMediaType): boolean {
  const url = mediaType === 'REEL' ? spec.videoUrl ?? spec.imageUrl : spec.imageUrl;
  return Boolean((url ?? '').trim());
}

/** Converte `scheduledAt` (ISO) em UNIX segundos; `null` se ausente/inválido. */
export function toScheduledStartSeconds(scheduledAt?: string): number | null {
  if (!scheduledAt) return null;
  const ms = new Date(scheduledAt).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

/**
 * Cria o container de mídia (passo 1). Se `spec.scheduledAt` estiver presente,
 * o `scheduled_start_time` é incluído e o resultado marca `scheduled:true`.
 * Não lança; devolve `no_media_source` quando falta imagem/vídeo.
 */
export async function createInstagramMediaContainer(
  access: InstagramAccess,
  spec: CreateMediaSpec,
  opts: PubOptions = {},
): Promise<CreateMediaResult> {
  const fetchImpl = resolveFetch(opts);
  if (!access?.accessToken || !access?.instagramUserId) {
    return { ok: false, error: 'meta_not_configured' };
  }
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };

  const mediaType: IgMediaType = spec.mediaType ?? 'IMAGE';
  if (!hasSource(spec, mediaType)) {
    return { ok: false, error: 'no_media_source' };
  }

  const scheduledStart = toScheduledStartSeconds(spec.scheduledAt);
  // A Graph API usa "REELS" para reels; o tipo interno "REEL" é um rótulo de UI.
  const apiMediaType: string = mediaType === 'REEL' ? 'REELS' : mediaType;
  const payload: Record<string, unknown> = { media_type: apiMediaType };
  if (spec.caption) payload.caption = spec.caption;
  if (mediaType === 'REEL') payload.video_url = (spec.videoUrl ?? spec.imageUrl ?? '').trim();
  else payload.image_url = (spec.imageUrl ?? '').trim();
  if (scheduledStart != null) payload.scheduled_start_time = scheduledStart;

  const url = `${baseFor(opts, access)}/${access.instagramUserId}/media`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const parsed = (await res.json()) as { id?: string; error?: { message?: string; code?: number } };
    if (res.ok) {
      return { ok: true, containerId: parsed.id, scheduled: scheduledStart != null };
    }
    const detail = parsed.error?.message
      ? `${parsed.error.code ?? res.status}: ${parsed.error.message}`
      : `HTTP ${res.status}`;
    return { ok: false, error: 'http_error', errorDetail: detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: 'network_error', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Publica um container (passo 2). Para um container agendado, esta chamada
 * efetiva o agendamento na Meta (ela publica no horário). Não lança.
 */
export async function publishInstagramMedia(
  access: InstagramAccess,
  containerId: string,
  opts: PubOptions = {},
): Promise<PublishResult> {
  const fetchImpl = resolveFetch(opts);
  if (!access?.accessToken || !access?.instagramUserId) {
    return { ok: false, error: 'meta_not_configured' };
  }
  if (!containerId) return { ok: false, error: 'no_media_source' };
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };

  const url =
    `${baseFor(opts, access)}/${access.instagramUserId}/media_publish` +
    `?creation_ids=${encodeURIComponent(containerId)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_ids: containerId }),
      signal: ctrl.signal,
    });
    const parsed = (await res.json()) as { id?: string; error?: { message?: string; code?: number } };
    if (res.ok) return { ok: true, mediaId: parsed.id, containerId };
    const detail = parsed.error?.message
      ? `${parsed.error.code ?? res.status}: ${parsed.error.message}`
      : `HTTP ${res.status}`;
    return { ok: false, containerId, error: 'http_error', errorDetail: detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, containerId, error: 'network_error', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fluxo completo (criar + publicar/agendar). Para uso da rota de "publicar
 * agora" e "agendar". Não lança: devolve o resultado agregado.
 */
export async function publishInstagramPost(
  access: InstagramAccess,
  spec: CreateMediaSpec,
  opts: PubOptions = {},
): Promise<{ ok: boolean; mediaId?: string; containerId?: string; scheduled?: boolean; error?: PubError; errorDetail?: string }> {
  const created = await createInstagramMediaContainer(access, spec, opts);
  if (!created.ok || !created.containerId) return { ...created };
  const published = await publishInstagramMedia(access, created.containerId, opts);
  if (!published.ok) return { ...published, containerId: created.containerId, scheduled: created.scheduled };
  return { ok: true, mediaId: published.mediaId, containerId: created.containerId, scheduled: created.scheduled };
}
