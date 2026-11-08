// Cliente Redis único (ioredis) para BullMQ, rate limiting e cache.
//
// Falta de Redis NÃO derruba a app: sem REDIS_URL o cliente não é criado
// (isRedisConfigured() → false) e os consumidores degradam (rate limit
// cai para janela em memória; jobs ficam só no backend Postgres).

import type { Redis } from 'ioredis';

// Suporte a múltiplas formas de conectar
const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

let client: Redis | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(REDIS_URL);
}

export function isRedisAvailable(): boolean {
  return client !== null && client.status === 'ready';
}

/**
 * Retorna o cliente singleton usando REDIS_URL (preferido).
 * Se REDIS_URL não estiver definido, usa host/port/password separados.
 */
export async function getRedisConnection(): Promise<Redis> {
  if (client && client.status === 'ready') return client;

  const { default: IORedis } = await import('ioredis');

  client = new IORedis({
    // REDIS_URL é preferido (formato: redis://[:password@]host:port)
    ...(REDIS_URL ? undefined : {
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD || undefined,
    }),
    // Se REDIS_URL for usado, passa como string direta
    ...(REDIS_URL ? { url: REDIS_URL } : undefined),
    lazyConnect: true,
    maxRetriesPerRequest: null, // exigido pelo BullMQ (comandos blocking)
    connectTimeout: 10_000,
    retryStrategy: (times) => (times > 10 ? null : Math.min(times * 200, 2_000)),
  });

  client.on('error', () => {
    // Error handling is deferred to individual calls
  });

  try {
    await client.connect();
    return client;
  } catch (e) {
    client = null;
    throw e;
  }
}

/** Encerra o cliente (testes / shutdown gracioso). */
export async function closeRedis(): Promise<void> {
  if (client) {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
    client = null;
  }
}

// Conexão síncrona para uso em testes
let syncClient: Redis | null = null;

export function getRedis(): Redis | null {
  if (syncClient && syncClient.status === 'ready') return syncClient;

  const { default: IORedis } = require('ioredis') as { default: typeof import('ioredis').default };

  syncClient = new IORedis({
    ...(REDIS_URL ? { url: REDIS_URL } : {
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD || undefined,
    }),
    lazyConnect: Boolean(REDIS_URL), // Só lazy se usando REDIS_URL
    maxRetriesPerRequest: null,
    connectTimeout: 10_000,
  });

  return syncClient;
}