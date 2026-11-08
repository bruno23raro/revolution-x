// src/lib/sentry-api.ts — Sentry integration helper for API routes
// Wrapper functions to capture errors in Next.js API routes.

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Wraps an API route handler with Sentry error reporting
 * Usage: export const GET = withSentry(handleRequest)
 */
export function withSentry<T extends (req: NextRequest) => Promise<NextResponse>>(handler: T) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(req);
    } catch (error) {
      captureException(error, {
        route: req.nextUrl.pathname,
        method: req.method,
      });
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

/**
 * Captures an exception with additional context
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  Sentry.captureException(error, {
    contexts: {
      context: context ?? {},
    },
  });
}

/**
 * Logs a message to Sentry as a breadcrumb
 * Level válido: 'error' | 'warning' | 'info' | 'debug'
 */
export function addBreadcrumb(
  category: string,
  message: string,
  level?: 'error' | 'warning' | 'info' | 'debug',
  data?: Record<string, unknown>,
) {
  Sentry.addBreadcrumb({
    category,
    message,
    level: level ?? 'info',
    data,
    timestamp: Date.now(),
  });
}

/**
 * Sets user context for Sentry
 */
export function setUser(user: { id: string; email?: string; organizationId?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
  });
}

/**
 * Clears user context (call on logout)
 */
export function clearUser() {
  Sentry.setUser(null);
}