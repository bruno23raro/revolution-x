// Unified rate limiter: in-memory (dev/test) + Upstash (prod) via middleware
// Re-export core functions; middleware.ts uses Upstash for production

type Bucket = { count: number; reset: number };
const mem = new Map<string, Bucket>();

export function rateLimit(key: string, limit = 10, windowMs = 60000) {
  const now = Date.now();
  const b = mem.get(key);
  if (!b || b.reset < now) { mem.set(key, { count: 1, reset: now + windowMs }); return { ok: true, left: limit - 1 }; }
  b.count++;
  return { ok: b.count <= limit, left: Math.max(0, limit - b.count) };
}

export function clientKey(req: Request, extra = "") {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "local";
  return `${ip}:${extra}`;
}

// Email-based rate limit key for auth routes
export async function emailRateLimitKey(req: Request): Promise<string> {
  const body = req.method === 'POST' || req.method === 'PUT'
    ? await req.clone().json().catch(() => ({}))
    : {};
  return `email:${body.email ?? ''}:${clientKey(req)}`;
}