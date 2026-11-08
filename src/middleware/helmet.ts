import { NextRequest, NextResponse } from 'next/server';

/**
 * Security headers middleware for Next.js
 * Applies Helmet-style security headers to all responses
 */

const SECURITY_HEADERS = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  // XSS Protection (legacy but still useful)
  'X-XSS-Protection': '1; mode=block',
  // Referrer Policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Permissions Policy
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  // HSTS (1 year, includeSubDomains, preload)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  // Content Security Policy (adjust as needed)
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net https://*.facebook.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co https://*.facebook.com wss://*.supabase.co",
    "frame-src 'self' https://www.facebook.com https://connect.facebook.net",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; '),
} as const;

/**
 * Apply security headers to a response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Security headers middleware for Next.js API routes
 */
export function withSecurityHeaders<
  S extends Record<string, unknown>,
  R extends Response
>(
  handler: (req: NextRequest, context: S) => Promise<R>,
  options?: {
    skipCors?: boolean;
  } & S
): (req: NextRequest, context: S) => Promise<R> {
  return async (req: NextRequest, context: S): Promise<R> => {
    const response = await handler(req, context);

    if (!(response instanceof NextResponse)) {
      return response;
    }

    // Apply security headers
    applySecurityHeaders(response);

    // Add CORS headers for API routes (if not skipped)
    if (!options?.skipCors) {
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }

    return response as unknown as R;
  };
}

/**
 * CORS middleware for Next.js API routes
 */
export function withCors<
  S extends Record<string, unknown>,
  R extends Response
>(
  handler: (req: NextRequest, context: S) => Promise<R>,
  options?: {
    origin?: string | string[];
    methods?: string[];
    headers?: string[];
  } & S
): (req: NextRequest, context: S) => Promise<R> {
  const allowedOrigins = typeof options?.origin === 'string'
    ? [options.origin]
    : options?.origin || ['*'];

  return async (req: NextRequest, context: S): Promise<R> => {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });

      const origin = req.headers.get('origin') || '*';
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Methods', options?.methods?.join(', ') || 'GET, POST, PUT, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', options?.headers?.join(', ') || 'Content-Type, Authorization');
        response.headers.set('Access-Control-Max-Age', '86400');
      }

      return response as unknown as R;
    }

    const response = await handler(req, context);

    if (!(response instanceof NextResponse)) {
      return response;
    }

    const origin = req.headers.get('origin') || '*';
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }

    return response;
  };
}

/**
 * Combine security headers and CORS into a single middleware
 */
export function withSecureApi<
  S extends Record<string, unknown>,
  R extends Response
>(
  handler: (req: NextRequest, context: S) => Promise<R>,
  options?: {
    origin?: string | string[];
    methods?: string[];
    headers?: string[];
    skipCors?: boolean;
  } & S
): (req: NextRequest, context: S) => Promise<R> {
  const corsHandler = withCors(handler, options);
  return withSecurityHeaders(corsHandler, options);
}