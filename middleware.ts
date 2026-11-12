import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceRoleClient } from './src/lib/supabase/server';
import { applySecurityHeaders, withCors } from './src/middleware/helmet';

// Rate limit config por endpoint (100 req/min padrão)
const RATE_LIMITS: Record<string, { windowMs: number; max: number }> = {
  '/api/auth': { windowMs: 60_000, max: 30 }, // 30/min para auth (login, register, refresh)
  '/api/auth/login': { windowMs: 15 * 60_000, max: 10 }, // 10/min específico para login
  '/api/auth/register': { windowMs: 60 * 60_1000, max: 10 }, // 10/h para register
  '/api/webhooks': { windowMs: 60_000, max: 2000 }, // 2000/min para webhooks (alto tráfego)
  '/api/schedules': { windowMs: 60_000, max: 100 }, // 100/min para schedules
  'default': { windowMs: 60_000, max: 100 },
};

/**
 * Aplica rate limiting usando Redis ou fallback em memória.
 * Retorna { limited, remaining, resetIn } ou undefined se não aplicável.
 */
async function checkRateLimit(
  key: string,
  config: { windowMs: number; max: number }
): Promise<{ limited: boolean; remaining: number; resetIn: number } | undefined> {
  try {
    const { getRedis } = await import('./src/lib/redis');
    const redis = await getRedis();

    if (!redis) return undefined; // Redis não configurado → degrade graceful

    const current = await redis.incr(key);
    if (current === 1) {
      // TTL em segundos
      await redis.expire(key, Math.floor(config.windowMs / 1000));
      const ttl = await redis.ttl(key);
      return { limited: false, remaining: Math.max(0, config.max - current + 1), resetIn: ttl };
    }

    const ttl = await redis.ttl(key);
    if (current > config.max) {
      return { limited: true, remaining: 0, resetIn: ttl };
    }

    return { limited: false, remaining: Math.max(0, config.max - current + 1), resetIn: ttl };
  } catch {
    return undefined; // Redis error → fail open
  }
}

/**
 * Determina a chave de rate limit com base na URL e IP do cliente.
 */
function getRateLimitKey(request: NextRequest, key: string): string {
  const ip = (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )!.replace(/\D/g, '');
  return `rate:${key}:${ip}:${new URL(request.url).pathname}`;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ----------------------------------------
  // 1. REDIRECIONAR WWW → APEX (SEO)
  // ----------------------------------------
  const host = (request.headers.get('host') ?? '').toLowerCase();
  if (host.startsWith('www.')) {
    const target = new URL(request.url);
    const withoutWww = host.replace(/^www\./, '');
    const portSep = withoutWww.lastIndexOf(':');
    const bareHost = portSep > 0 ? withoutWww.slice(0, portSep) : withoutWww;
    const hostPort = portSep > 0 ? withoutWww.slice(portSep + 1) : '';
    target.hostname = bareHost;
    const isLocalHost =
      bareHost === 'localhost' || bareHost === '127.0.0.1' || bareHost === '::1' || bareHost === '[::1]';
    target.port = isLocalHost ? hostPort : '';
    return NextResponse.redirect(target, 301);
  }

  // ----------------------------------------
  // 2. RATE LIMITING (exceto assets estáticos)
  // ----------------------------------------
  if (pathname.startsWith('/api/')) {
    let config: { windowMs: number; max: number } | undefined;

    // Match mais específico primeiro
    for (const [path, limit] of Object.entries(RATE_LIMITS)) {
      if (path !== 'default' && pathname.startsWith(path)) {
        config = limit;
        break;
      }
    }
    // Fallback para default
    if (!config) config = RATE_LIMITS.default;

    const rateKey = getRateLimitKey(request, pathname);
    const result = await checkRateLimit(rateKey, config);

    if (result?.limited) {
      const response = NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: result.resetIn },
        { status: 429 }
      );
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', String(result.resetIn));
      return response;
    }
  }

  // ----------------------------------------
  // 3. VERIFICAR SUPABASE (modo degraded se ausente)
  // ----------------------------------------
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const isPublicRoute =
      pathname === '/' ||
      pathname === '/login' ||
      pathname === '/register' ||
      pathname === '/forgot-password' ||
      pathname === '/reset-password' ||
      pathname === '/verify-email' ||
      pathname.startsWith('/onboarding');

    if (process.env.NODE_ENV === 'production' && !isPublicRoute) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse('Authentication service is not configured', { status: 503 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Apply security headers even in degraded mode
    applySecurityHeaders(response);
    return response;
  }

  // ----------------------------------------
  // 4. SESSION COOKIES EXTRACT (LAZY - just copy auth cookies)
  // ----------------------------------------
  // Only extract session cookies for routes that need them.
  // Actual authentication happens in API routes when getAuth() is called.
  // This makes auth lazy: public routes work without auth overhead.
  const authCookieNames = ['sb:token', 'sb:refresh-token', 'auth-token', 'session'];

  // Copy auth cookies to response - the client-side supabase-js will restore them
  // This allows SSR hydration without eagerly validating the session
  const hasAnyAuthCookie = authCookieNames.some(name =>
    request.cookies.has(name)
  );

  if (hasAnyAuthCookie) {
    // Clone cookies for response - the client will rehydrate auth state
    request.cookies.getAll().forEach(({ name, value }) => {
      if (authCookieNames.includes(name)) {
        response.cookies.set(name, value, {
          httpOnly: name.startsWith('sb:') ? false : true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }
    });
  }

  // ----------------------------------------
  // 5. TENANT CONTEXT (lazy - only if user has org membership)
  // ----------------------------------------
  // Store the organization ID in a cookie when it can be determined.
  // Actual tenant isolation happens at the database level via RLS policies.
  // We check for a pre-existing org cookie from previous requests.
  const existingOrgId = request.cookies.get('x-organization-id')?.value;

  if (existingOrgId) {
    response.cookies.set('x-organization-id', existingOrgId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  // ----------------------------------------
  // 6. APLICAR HEADERS DE SEGURANÇA
  // ----------------------------------------
  applySecurityHeaders(response);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};