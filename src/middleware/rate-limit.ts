import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../lib/logger';
import { getRedisConnection, isRedisAvailable } from '../lib/redis';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  statusCode?: number;
}

const defaultConfig: Record<string, RateLimitConfig> = {
  'auth': { windowMs: 15 * 60 * 1000, max: 10, message: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  'register': { windowMs: 60 * 60 * 1000, max: 5, message: 'Limite de registros atingido.' },
  'api': { windowMs: 60 * 1000, max: 100, message: 'Limite de requisições atingido.' },
  'webhook': { windowMs: 60 * 1000, max: 1000, message: 'Limite de webhooks atingido.' },
  'default': { windowMs: 60 * 1000, max: 100, message: 'Rate limit excedido' },
};

/**
 * Rate limiting middleware usando Redis
 */
export async function rateLimit(
  request: NextRequest,
  key: string = 'default',
  config: Partial<RateLimitConfig> = {}
): Promise<{ limited: boolean; remaining: number; resetIn: number }> {
  const finalConfig = { ...defaultConfig[key || 'default'], ...config };
  const url = new URL(request.url);

  // Create unique key per IP + endpoint
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const rateKey = `rate-limit:${key}:${ip}:${url.pathname}`;

  try {
    const redis = await getRedisConnection();

    // Increment counter
    const current = await redis.incr(rateKey);

    // Get TTL for window
    const ttl = await redis.ttl(rateKey);

    // Set expiry if this is a new key
    if (current === 1) {
      await redis.expire(rateKey, Math.floor(finalConfig.windowMs / 1000));
    }

    const remaining = Math.max(0, finalConfig.max - current + 1);
    const resetIn = ttl;

    if (current > finalConfig.max) {
      logger.warn({ ip, key, path: url.pathname, current }, 'Rate limit exceeded');
      return { limited: true, remaining: 0, resetIn };
    }

    return { limited: false, remaining, resetIn };
  } catch (err) {
    // Redis unavailable - fail open (don't block requests)
    logger.error({ err, ip }, 'Redis rate limit check failed');
    return { limited: false, remaining: finalConfig.max, resetIn: 0 };
  }
}

/**
 * Middleware wrapper for Next.js API routes
 */
export function withRateLimit<
  S extends Record<string, unknown>,
  R extends Response
>(
  handler: (req: NextRequest, context: S) => Promise<R>,
  options?: {
    key?: string;
    config?: RateLimitConfig;
  } & S
): (req: NextRequest, context: S) => Promise<R> {
  return async (req: NextRequest, context: S): Promise<R> => {
    const { limited, remaining, resetIn } = await rateLimit(
      req,
      options?.key || 'default',
      options?.config
    );

    if (limited) {
      const response = NextResponse.json(
        {
          error: options?.config?.message || defaultConfig.default.message,
          rateLimit: {
            remaining: 0,
            resetIn,
          }
        },
        { status: options?.config?.statusCode || 429 }
      );

      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', String(resetIn));

      return response as unknown as R;
    }

    const response = await handler(req, context);

    // Add rate limit headers to response
    if (response instanceof NextResponse) {
      response.headers.set('X-RateLimit-Remaining', String(remaining));
      if (resetIn > 0) {
        response.headers.set('X-RateLimit-Reset', String(resetIn));
      }
    }

    return response as unknown as R;
  };
}