// FASE 2 · slice 3 — Publicação + tracking de vídeos via Content Posting API
// oficial do TikTok (open.tiktokapis.com).
//
// Fluxo real (documentação oficial):
//   • Publicar:  POST /v2/post/publish/video/init/  (source PULL_FROM_URL, com
//     `video_url`) → devolve `data.publish_id`. O post inicia de forma
//     IMEDIATA — a API do TikTok NÃO tem `scheduled_start_time` (diferente da
//     Meta), então "agendamento" é persistido como intenção pela rota (a
//     execução em hora marcada é do agendador — FASE 4).
//   • Status:    POST /v2/post/publish/status/fetch/ { publish_id } → `data.status`
//     (INIT → READY_TO_PUBLISH → PUBLISHED | FAILED).
//   • Tracking:  GET  /v2/post/publish/video/data/?publish_ids=[...] (máx. 5)
//     → `data[]` com métricas por vídeo (play/like/comentário/compartilhamento).
//
// Assim como os demais serviços, NÃO lança: retorna `ok`/`error` honesto e
// degrada quando falta credencial/fetch/fonte de vídeo. `fetchImpl` é
// injetável para testes sem rede.

const DEFAULT_BASE = 'https://open.tiktokapis.com';

export interface TikTokAccess {
  accessToken: string;
  apiBase?: string;
}

export type TtPubError =
  | 'tiktok_not_configured'
  | 'fetch_unavailable'
  | 'no_video_source'
  | 'http_error'
  | 'network_error';

/** Níveis de privacidade aceitos por `post_info.privacy_level`. */
export type TikTokPrivacyLevel =
  | 'PUBLIC_TO_EVERYONE'
  | 'MUTUAL_FOLLOW_FRIENDS'
  | 'FOLLOWER_OF_CREATORS'
  | 'SELF_ONLY';

export const TIKTOK_PRIVACY_LEVELS: readonly TikTokPrivacyLevel[] = [
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATORS',
  'SELF_ONLY',
];

export interface PublishVideoSpec {
  /** URL pública do vídeo (o servidor do TikTok puxa — PULL_FROM_URL). */
  videoUrl?: string;
  /** Legenda (title). Máx. 2200 caracteres. Opcional. */
  caption?: string;
  privacyLevel?: TikTokPrivacyLevel;
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
  /** `true` quando é parceria paga com uma marca. */
  brandContent?: boolean;
  /** `true` quando o conteúdo é gerado por IA. */
  aigc?: boolean;
  videoCoverTimestampMs?: number;
}

export interface PublishVideoResult {
  ok: boolean;
  publishId?: string;
  error?: TtPubError;
  errorDetail?: string;
}

export interface PostStatusResult {
  ok: boolean;
  publishId?: string;
  /** Estado atual (INIT / PENDING / READY_TO_PUBLISH / PUBLISHED / FAILED). */
  status?: string;
  error?: TtPubError;
  errorDetail?: string;
}

export interface VideoDataItem {
  publishId: string;
  isValid?: boolean;
  status?: string;
  playCount?: number;
  likeCount?: number;
  shareCount?: number;
  downloadCount?: number;
  commentCount?: number;
}

export interface VideoAnalyticsResult {
  ok: boolean;
  items: VideoDataItem[];
  error?: TtPubError;
  errorDetail?: string;
}

export interface TtPubOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  apiBase?: string;
}

// ---------------------------------------------------------------------------
// Agendamento (intenção persistida) — a API oficial do TikTok NÃO tem
// `scheduled_start_time`. O produto persiste a INTENÇÃO (o que publicar e
// quando); a execução em hora marcada é do agendador da FASE 4. Isto aqui é
// o registro dessa intenção — puro e testável, sem rede.
// ---------------------------------------------------------------------------

export interface PendingTikTokPost {
  /** ID local (não é o `publish_id` da API — esse só existe após publicar). */
  id: string;
  createdAt: string;
  /** ISO 8601 — quando a FASE 4 deve executar. */
  scheduledAt: string;
  spec: PublishVideoSpec;
  /** Rastreável pela rota ao publicar. */
  publishId?: string;
  status?: 'pending' | 'published' | 'failed';
  /** Contagem de tentativas de publicação falhas (retry c/ backoff — FASE 4 · slice 2). */
  attempts?: number;
  /** MULTICONTAS — openId da conta TikTok a publicar (ausente = conta padrão). */
  account?: string;
}

/** Acrescenta uma intenção na fila persistente (não modifica `existing`). */
export function appendPendingTikTokPost(
  existing: PendingTikTokPost[] | null | undefined,
  item: PendingTikTokPost,
): PendingTikTokPost[] {
  return [...(existing ?? []), item];
}

/**
 * Marca/atualiza uma intenção (por `id`): status (publicado/falhou/pendente),
 * `publishId`, `attempts` (retry) e `scheduledAt` (reagendamento c/ backoff).
 * Não modifica a origem.
 */
export function markPendingTikTokPost(
  existing: PendingTikTokPost[] | null | undefined,
  id: string,
  patch: {
    status?: PendingTikTokPost['status'];
    publishId?: string;
    attempts?: number;
    scheduledAt?: string;
  },
): PendingTikTokPost[] {
  const list = existing ?? [];
  return list.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

function baseFor(opts: TtPubOptions, access: TikTokAccess): string {
  return (opts.apiBase ?? access.apiBase ?? DEFAULT_BASE).replace(/\/+$/, '');
}

function resolveFetch(opts: TtPubOptions): typeof fetch | undefined {
  return opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
}

function guardCommon(access: TikTokAccess, opts: TtPubOptions): TtPubError | null {
  if (!access?.accessToken) return 'tiktok_not_configured';
  if (!resolveFetch(opts)) return 'fetch_unavailable';
  return null;
}

function headers(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json; charset=UTF-8',
  };
}

/**
 * Inicia a publicação de um vídeo (PULL_FROM_URL). Não lança; devolve
 * `no_video_source` quando falta `videoUrl` e `tiktok_not_configured`/
 * `fetch_unavailable` quando faltam credencial/fetch.
 */
export async function publishTikTokVideo(
  access: TikTokAccess,
  spec: PublishVideoSpec,
  opts: TtPubOptions = {},
): Promise<PublishVideoResult> {
  const common = guardCommon(access, opts);
  if (common) return { ok: false, error: common };
  const videoUrl = (spec.videoUrl ?? '').trim();
  if (!videoUrl) return { ok: false, error: 'no_video_source' };
  const fetchImpl = resolveFetch(opts)!;

  const postInfo: Record<string, unknown> = {
    privacy_level: spec.privacyLevel ?? 'PUBLIC_TO_EVERYONE',
    brand_content_toggle: Boolean(spec.brandContent),
  };
  const caption = (spec.caption ?? '').trim();
  if (caption) postInfo.title = caption;
  if (typeof spec.disableComment === 'boolean') postInfo.disable_comment = spec.disableComment;
  if (typeof spec.disableDuet === 'boolean') postInfo.disable_duet = spec.disableDuet;
  if (typeof spec.disableStitch === 'boolean') postInfo.disable_stitch = spec.disableStitch;
  if (typeof spec.aigc === 'boolean') postInfo.is_aigc = spec.aigc;
  if (typeof spec.videoCoverTimestampMs === 'number') {
    postInfo.video_cover_timestamp_ms = spec.videoCoverTimestampMs;
  }

  const url = `${baseFor(opts, access)}/v2/post/publish/video/init/`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: headers(access.accessToken),
      body: JSON.stringify({
        post_info: postInfo,
        source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
      }),
      signal: ctrl.signal,
    });
    const parsed = (await res.json().catch(() => null)) as {
      data?: { publish_id?: string };
      error?: { code?: string; message?: string };
    } | null;
    if (res.ok && parsed?.error?.code === 'ok' && parsed.data?.publish_id) {
      return { ok: true, publishId: String(parsed.data.publish_id) };
    }
    const detail = parsed?.error?.message
      ? `${parsed.error.code ?? res.status}: ${parsed.error.message}`
      : `HTTP ${res.status}`;
    return { ok: false, error: 'http_error', errorDetail: detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: 'network_error', errorDetail: msg === 'AbortError' ? `timeout ${opts.timeoutMs ?? 20000}ms` : msg };
  } finally {
    clearTimeout(timer);
  }
}

/** Consulta o estado de um `publish_id` (POST /v2/post/publish/status/fetch/). */
export async function getTikTokPostStatus(
  access: TikTokAccess,
  publishId: string,
  opts: TtPubOptions = {},
): Promise<PostStatusResult> {
  const common = guardCommon(access, opts);
  if (common) return { ok: false, error: common };
  const id = (publishId ?? '').trim();
  if (!id) return { ok: false, error: 'no_video_source', errorDetail: 'publish_id ausente' };
  const fetchImpl = resolveFetch(opts)!;

  const url = `${baseFor(opts, access)}/v2/post/publish/status/fetch/`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: headers(access.accessToken),
      body: JSON.stringify({ publish_id: id }),
      signal: ctrl.signal,
    });
    const parsed = (await res.json().catch(() => null)) as {
      data?: { status?: string };
      error?: { code?: string; message?: string };
    } | null;
    if (res.ok && parsed?.error?.code === 'ok') {
      return { ok: true, publishId: id, status: parsed.data?.status };
    }
    const detail = parsed?.error?.message
      ? `${parsed.error.code ?? res.status}: ${parsed.error.message}`
      : `HTTP ${res.status}`;
    return { ok: false, publishId: id, error: 'http_error', errorDetail: detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, publishId: id, error: 'network_error', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Busca métricas de até 5 `publish_id`s (GET /v2/post/publish/video/data/).
 * Parser defensivo: ausente/erro devolve `items: []` + `ok:false` (honesta).
 */
export async function getTikTokVideoAnalytics(
  access: TikTokAccess,
  publishIds: string[],
  opts: TtPubOptions = {},
): Promise<VideoAnalyticsResult> {
  const common = guardCommon(access, opts);
  if (common) return { ok: false, items: [], error: common };
  const ids = (publishIds ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 5);
  if (ids.length === 0) {
    return { ok: false, items: [], error: 'no_video_source', errorDetail: 'publish_ids vazios' };
  }
  const fetchImpl = resolveFetch(opts)!;

  const q = encodeURIComponent(JSON.stringify(ids));
  const url = `${baseFor(opts, access)}/v2/post/publish/video/data/?publish_ids=${q}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: headers(access.accessToken),
      signal: ctrl.signal,
    });
    const parsed = (await res.json().catch(() => null)) as {
      data?: Array<{
        publish_id?: string;
        is_valid?: boolean;
        status?: string;
        data?: {
          play_count?: number;
          like_count?: number;
          share_count?: number;
          download_count?: number;
          comment_count?: number;
        };
      }>;
      error?: { code?: string; message?: string };
    } | null;
    if (res.ok && parsed?.error?.code === 'ok') {
      const items: VideoDataItem[] = (parsed.data ?? []).map((row) => ({
        publishId: String(row.publish_id ?? ''),
        isValid: row.is_valid,
        status: row.status,
        playCount: row.data?.play_count,
        likeCount: row.data?.like_count,
        shareCount: row.data?.share_count,
        downloadCount: row.data?.download_count,
        commentCount: row.data?.comment_count,
      }));
      return { ok: true, items };
    }
    const detail = parsed?.error?.message
      ? `${parsed.error.code ?? res.status}: ${parsed.error.message}`
      : `HTTP ${res.status}`;
    return { ok: false, items: [], error: 'http_error', errorDetail: detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, items: [], error: 'network_error', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}
