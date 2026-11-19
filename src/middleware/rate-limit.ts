import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

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

// Upstash Redis client (fail-open if not configured)
const hasUpstashConfig = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

const upstashRedis = hasUpstashConfig ? new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
}) : null;

// Ratelimit instances for each config (only created if Upstash is configured)
const ratelimitInstances: Record<string, any> = {};
if (hasUpstashConfig && upstashRedis) {
  for (const [key, config] of Object.entries(defaultConfig)) {
    const windowSec = Math.ceil(config.windowMs / 1000);
    ratelimitInstances[key] = new Ratelimit({
      redis: upstashRedis,
      limiter: Ratelimit.slidingWindow(config.max, `${windowSec} s`),
      prefix: '@upstash/ratelimit',
    });
  }
}

/**
 * Rate limiting middleware usando Upstash Redis
 * Fail-open: if Redis is not configured, allow all requests
 */
export async function rateLimit(
  request: NextRequest,
  key: string = 'default',
  config: Partial<RateLimitConfig> = {}
): Promise<{ limited: boolean; remaining: number; resetIn: number }> {
  const finalConfig = { ...defaultConfig[key || 'default'], ...config };
  const url = new URL(request.url);

  // If Upstash is not configured, fail-open (allow all requests)
  if (!hasUpstashConfig) {
    return { limited: false, remaining: finalConfig.max, resetIn: Math.ceil(finalConfig.windowMs / 1000) };
  }

  // Create unique key per IP + endpoint
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const identifier = `rate:${key}:${ip}:${url.pathname}`;

  try {
    // Use specific instance or default
    const ratelimit = ratelimitInstances[key] || ratelimitInstances.default;
    const { success, remaining, reset } = await ratelimit.limit(identifier);

    const resetIn = Math.max(0, Math.ceil((reset - Date.now()) / 1000));

    if (!success) {
      logger.warn({ ip, key, path: url.pathname }, 'Rate limit exceeded');
      return { limited: true, remaining: 0, resetIn };
    }

    return { limited: false, remaining, resetIn };
  } catch (err) {
    // Fail-open: if Redis is unavailable, allow the request
    logger.warn({ err, ip }, 'Upstash Redis rate limit check failed - failing open');
    return { limited: false, remaining: finalConfig.max, resetIn: Math.ceil(finalConfig.windowMs / 1000) };
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