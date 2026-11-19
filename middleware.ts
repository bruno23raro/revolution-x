import { NextResponse, type NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Edge runtime: sem crypto do Node, sem Prisma, sem jsonwebtoken.
// Aqui só: headers, rate limit em memória e presença de cookie.
// A verificação real do token fica nas rotas, que rodam em Node.
// ---------------------------------------------------------------------------

const mem = new Map<string, { count: number; reset: number }>();

const RATE_LIMITS: Record<string, { windowMs: number; max: number }> = {
  '/api/auth/login': { windowMs: 15 * 60_000, max: 10 },
  '/api/auth/register': { windowMs: 60 * 60_000, max: 10 },
  '/api/auth/forgot-password': { windowMs: 60 * 60_000, max: 5 },
  '/api/auth/resend-verification': { windowMs: 60 * 60_000, max: 5 },
  '/api/auth': { windowMs: 60_000, max: 30 },
  '/api/webhooks': { windowMs: 60_000, max: 2000 },
  '/api/schedules': { windowMs: 60_000, max: 100 },
};

const DEFAULT_LIMIT = { windowMs: 60_000, max: 100 };

function checkRateLimit(key: string, config: { windowMs: number; max: number }) {
  const now = Date.now();
  const bucket = mem.get(key);
  if (!bucket || bucket.reset < now) {
    mem.set(key, { count: 1, reset: now + config.windowMs });
    return { limited: false, resetIn: Math.ceil(config.windowMs / 1000) };
  }
  bucket.count++;
  const limited = bucket.count > config.max;
  return { limited, resetIn: Math.ceil((bucket.reset - now) / 1000) };
}

const PUBLIC_PAGES = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]);

const PUBLIC_PAGE_PREFIXES = ['/onboarding'];
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/webhooks/'];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PAGES.has(pathname) ||
    PUBLIC_PAGE_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))
  );
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-DNS-Prefetch-Control', 'off');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
}

// Proteção de rotas /api/dev/* em produção
function isDevRoute(pathname: string): boolean {
  return pathname.startsWith('/api/dev/');
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = (request.headers.get('host') ?? '').toLowerCase();

  // Bloquear /api/dev/* em produção com 403
  if (isDevRoute(pathname) && isProduction()) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: 'forbidden', message: 'Development routes disabled in production' },
        { status: 403 }
      )
    );
  }

  // www -> apex
  if (host.startsWith('www.')) {
    const target = new URL(request.url);
    const withoutWww = host.replace(/^www\./, '');
    const portSep = withoutWww.lastIndexOf(':');
    const bareHost = portSep > 0 ? withoutWww.slice(0, portSep) : withoutWww;
    const hostPort = portSep > 0 ? withoutWww.slice(portSep + 1) : '';
    target.hostname = bareHost;
    const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(bareHost);
    target.port = isLocal ? hostPort : '';
    return NextResponse.redirect(target, 301);
  }

  // rate limit só em API
  if (pathname.startsWith('/api/')) {
    let config = DEFAULT_LIMIT;
    for (const [path, limit] of Object.entries(RATE_LIMITS)) {
      if (pathname.startsWith(path)) {
        config = limit;
        break;
      }
    }
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    const { limited, resetIn } = checkRateLimit(`${ip}:${pathname}`, config);
    if (limited) {
      const r = NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: resetIn },
        { status: 429 }
      );
      r.headers.set('X-RateLimit-Remaining', '0');
      r.headers.set('X-RateLimit-Reset', String(resetIn));
      return applySecurityHeaders(r);
    }
  }

  // gate de sessão: só presença de cookie
  if (!isPublic(pathname)) {
    const hasSession = Boolean(request.cookies.get('access_token')?.value);
    if (!hasSession) {
      if (pathname.startsWith('/api/')) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: 'unauthorized', message: 'Authentication required' },
            { status: 401 }
          )
        );
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return applySecurityHeaders(NextResponse.next({ request }));
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};