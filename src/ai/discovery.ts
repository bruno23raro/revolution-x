// FASE 18 — Descoberta dinâmica de modelos (§13) com cache TTL em memória.
//
// Stale-while-revalidate: dentro do TTL devolve o cache; expirado, devolve o
// valor antigo (marcado `stale:true`) e revalida em segundo plano. `now`/`ttlMs`
// são injetáveis → determinístico em teste, sem espera real.

import type { AiModel, AiProvider } from './aiTypes';

export interface DiscoveryResult {
  providerId: string;
  models: AiModel[];
  source: 'api' | 'fallback' | 'none';
  /** Instante (ms) em que o resultado foi obtido da API. */
  cachedAt: number;
  /** `true` quando devolvemos o valor antigo durante revalidação. */
  stale: boolean;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1h

// Cache em memória por provedor (NUNCA vaza segredo: só metadados de modelos).
const cache = new Map<string, { result: DiscoveryResult; at: number }>();

/** Limpa o cache (útil em teste e quando a credencial muda). */
export function clearDiscoveryCache(): void {
  cache.clear();
}

export async function discoverModels(
  provider: AiProvider,
  opts: { ttlMs?: number; now?: number } = {},
): Promise<DiscoveryResult> {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const now = opts.now ?? Date.now();
  const hit = cache.get(provider.id);

  // Ainda válido → devolve o cache direto (stale:false).
  if (hit && now - hit.at < ttl) {
    return { ...hit.result, providerId: provider.id, stale: false };
  }

  // Expirado (ou ausente): revalida. Se há valor antigo, devolve-o imediatamente
  // (stale-while-revalidate) e atualiza em background; senão aguarda a chamada.
  const stale = hit?.result ?? null;
  const refresh = provider
    .listModels()
    .then((r) => {
      const result: DiscoveryResult = {
        providerId: provider.id,
        models: r.models,
        source: r.source,
        cachedAt: r.fetchedAt,
        stale: false,
      };
      cache.set(provider.id, { result, at: r.fetchedAt });
      return result;
    })
    .catch(() => stale ?? undefined); // listModels degrada a fallback, não lança

  if (stale) {
    void refresh; // não bloqueia
    return { ...stale, providerId: provider.id, stale: true };
  }

  const result = await refresh;
  if (!result) {
    return { providerId: provider.id, models: [], source: 'none', cachedAt: now, stale: false };
  }
  return result;
}
