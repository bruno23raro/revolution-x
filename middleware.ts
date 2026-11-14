import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceRoleClient } from './src/lib/supabase/server';
import { applySecurityHeaders, withCors } from './src/middleware/helmet';

const RATE_LIMITS: Record<string, { windowMs: number; max: number }> = {
  '/api/auth': { windowMs: 60_000, max: 30 },
  '/api/auth/login': { windowMs: 15 * 60_000, max: 10 },
  '/api/auth/register': { windowMs: 60 * 60_1000, max: 10 },
  '/api/webhooks': { windowMs: 60_000, max: 2000 },
  '/api/schedules': { windowMs: 60_000, max: 100 },
  'default': { windowMs: 60_000, max: 100 },
};

const rateStore = new Map<string, { count: number; resetAt: number }>();

async function checkRateLimit(
  key: string,
  config: { windowMs: number; max: number }
): Promise<{ limited: boolean; remaining: number; resetIn: number } | undefined> {
  const now = Date.now();
  const resetAt = now + config.windowMs;
  const entry = rateStore.get(key);
if (!entry || entry.resetAt <= now) {
  rateStore.set(key, { count: 1, resetAt });
  return { limited: false, remaining: Math.max(0, config.max - 1), resetIn: Math.floor(config.windowMs / 1000) };
}
entry.count += 1;
if (entry.count > config.max) {
  return { limited: true, remaining: 0, resetIn: Math.max(0, Math.ceil((entry.resetAt - now) / 1000)) };
}
return { limited: false, remaining: Math.max(0, config.max - entry.count), resetIn: Math.max(0, Math.ceil((entry.resetAt - now) / 1000)) };
}

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
  const host = (request.headers.get('host') ?? '').toLowerCase();
  if (host.startsWith('www.')) {
    const target = new URL(request.url);
    const withoutWww = host.replace(/^www\./, '');
    const portSep = withoutWww.lastIndexOf(':');
    const bareHost = portSep > 0 ? withoutWww.slice(0, portSep) : withoutWww;
    const hostPort = portSep > 0 ? withoutWww.slice(portSep + 1) : '';
    target.hostname = bareHost;
    const isLocalHost = bareHost === 'localhost' || bareHost === '127.0.0.1' || bareHost === '::1' || bareHost === '[::1]';
    target.port = isLocalHost ? hostPort : '';
    return NextResponse.redirect(target, 301);
  }

  if (pathname.startsWith('/api/')) {
    let config: { windowMs: number; max: number } | undefined;
    for (const [path, limit] of Object.entries(RATE_LIMITS)) {
      if (path !== 'default' && pathname.startsWith(path)) { config = limit; break; }
    }
    if (!config) config = RATE_LIMITS.default;
    const rateKey = getRateLimitKey(request, pathname);
    const result = await checkRateLimit(rateKey, config);
    if (result?.limited) {
      const r = NextResponse.json({ error: 'Rate limit exceeded', retryAfter: result.resetIn }, { status: 429 });
      r.headers.set('X-RateLimit-Remaining', '0');
      r.headers.set('X-RateLimit-Reset', String(result.resetIn));
      return r;
    }
  }

  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const isPublicRoute =
      pathname === '/' || pathname === '/login' || pathname === '/register' ||
      pathname === '/forgot-password' || pathname === '/reset-password' ||
      pathname === '/verify-email' || pathname.startsWith('/onboarding');
    if (process.env.NODE_ENV === 'production' && !isPublicRoute) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse('Authentication service is not configured', { status: 503 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
    applySecurityHeaders(response);
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => { request.cookies.set(name, value); });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => { response.cookies.set(name, value, options); });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    applySecurityHeaders(response);
    return response;
  }

  try {
    const svc = createServiceRoleClient();
    const { data: members } = await svc
      .from('OrganizationMember')
      .select('organizationId')
      .eq('userId', user.id);
    const orgId = members?.[0]?.organizationId;
    if (orgId) {
      response.cookies.set('x-organization-id', orgId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
    }
  } catch {
    // Org lookup falhou -> segue sem cookie de org.
  }

  applySecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
