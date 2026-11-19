import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import * as log from './logger';

// ============================================================
// Auth constants — centralized configuration
// ============================================================

export const ACCESS_TOKEN_TTL = '15m';          // 15 minutes
export const REFRESH_TOKEN_TTL_DAYS = 30;       // 30 days
export const BCRYPT_COST = 12;                  // bcrypt cost factor

// Token family for refresh rotation (in-memory, single instance dev)
export interface TokenFamily {
  familyId: string;
  createdAt: number;
  revokedAt?: number;
}

// ============================================================
// Password hashing (bcrypt cost 12)
// ============================================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================================
// JWT helpers
// ============================================================

export function generateAccessToken(payload: object): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
  });
}

export function generateRefreshToken(payload: object): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d` as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): object | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as object;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): object | null {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as object;
  } catch {
    return null;
  }
}

export function isPasswordStrong(pw: string): boolean {
  return pw.length >= 10 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

// ============================================================
// Magic link token helpers (backward compat for tests/legacy)
// ============================================================

export const MAGIC_LINK_TTL_MS = 15 * 60_000;   // 15 minutes
export const MAGIC_LINK_TTL = '15m';            // JWT TTL for magic link

export function generateMagicLinkToken(payload: object): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: MAGIC_LINK_TTL as SignOptions['expiresIn'],
  });
}

export function verifyMagicLinkToken(token: string): object | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as object;
  } catch {
    return null;
  }
}

// ============================================================
// Cookie helpers — httpOnly, Secure, SameSite=Lax
// ============================================================

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * REFRESH_TOKEN_TTL_DAYS, // 30 days
};

export const ACCESS_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 15 * 60, // 15 minutes
};

export function setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string): void {
  response.cookies.set('access_token', accessToken, ACCESS_COOKIE_OPTIONS);
  response.cookies.set('refresh_token', refreshToken, COOKIE_OPTIONS);
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set('access_token', '', { ...ACCESS_COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set('refresh_token', '', { ...COOKIE_OPTIONS, maxAge: 0 });
}

export function getAccessToken(req: NextRequest): string | null {
  return req.cookies.get('access_token')?.value ?? null;
}

export function getRefreshToken(req: NextRequest): string | null {
  return req.cookies.get('refresh_token')?.value ?? null;
}

// ============================================================
// Token family management (refresh rotation)
// ============================================================

// In-memory token family store (replace with Redis for multi-instance)
const tokenFamilies = new Map<string, TokenFamily>();

export function createTokenFamily(familyId: string): void {
  tokenFamilies.set(familyId, { familyId, createdAt: Date.now() });
}

export function revokeTokenFamily(familyId: string): void {
  const family = tokenFamilies.get(familyId);
  if (family) {
    family.revokedAt = Date.now();
  }
}

export function isTokenFamilyValid(familyId: string): boolean {
  const family = tokenFamilies.get(familyId);
  return !!family && !family.revokedAt;
}

export function revokeAllUserTokenFamilies(userId: string): void {
  for (const [familyId, family] of tokenFamilies.entries()) {
    if (familyId.startsWith(`${userId}:`)) {
      family.revokedAt = Date.now();
    }
  }
}

// ============================================================
// Single Admin User (simplified - single organization)
// ============================================================

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  organizationId: string;
  role: string; // 'owner' for single admin
}

/**
 * Lazy auth: only validates session when explicitly called.
 * Single admin with single organization.
 */
export async function getAuth(
  req: NextRequest
): Promise<{ user: AuthenticatedUser | null; hasSession: boolean }> {
  const accessToken = getAccessToken(req);
  const payload = accessToken ? verifyAccessToken(accessToken) : null;

  if (!payload) {
    return { user: null, hasSession: false };
  }

  // Validate user exists in the database and get their organization
  let dbUser;
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: (payload as { sub: string }).sub },
      include: { organizationMembers: { take: 1 } },
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    log.error('[auth] getAuth: database error', e, {
      code: (e as { code?: string }).code,
      name: e.name
    });
    return { user: null, hasSession: true };
  }

  if (!dbUser) {
    log.info('[auth] getAuth: user not found in database');
    return { user: null, hasSession: true };
  }

  if (dbUser.organizationMembers.length === 0) {
    log.info('[auth] getAuth: user has no organization');
    return { user: null, hasSession: true };
  }

  const orgId = dbUser.organizationMembers[0].organizationId;

  return {
    user: {
      id: (payload as { sub: string }).sub,
      email: dbUser.email || null,
      organizationId: orgId,
      role: 'owner',
    },
    hasSession: true,
  };
}

/** @deprecated Use getAuth() instead for on-demand auth */
export async function getAuthenticatedUser(
  req: NextRequest
): Promise<AuthenticatedUser | null> {
  const { user } = await getAuth(req);
  return user;
}

// Returns ALL organizations the authenticated user belongs to (for backward compat)
export async function getAllOrganizationMemberships(
  req: NextRequest
): Promise<Array<{ organizationId: string; role: string }> | null> {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return null;

  return [{ organizationId: user.organizationId, role: 'owner' }];
}

// Validates that the authenticated user has membership in the given organization
export async function requireMembershipIn(
  req: NextRequest,
  organizationId: string
): Promise<AuthenticatedUser | null> {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  if (user.organizationId === organizationId) {
    return user;
  }
  return null;
}

// ============================================================
// Role-based authorization helper (simplified for single admin)
// ============================================================

export async function requireRole(
  req: NextRequest,
  allowedRoles: string[]
): Promise<AuthenticatedUser | null> {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  // Single admin with organization - if authenticated, allow all roles
  return user;
}

// ============================================================
// Magic link helpers (kept for future use, not active)
// ============================================================

export interface MagicLinkPayload {
  email: string;
  purpose: 'verify' | 'reset' | 'login';
  organizationId?: string;
}

export async function createMagicLink(email: string, purpose: MagicLinkPayload['purpose'], organizationId?: string): Promise<string> {
  const payload: MagicLinkPayload = { email, purpose, organizationId };
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: '15m' as SignOptions['expiresIn'],
  });
}

export async function verifyMagicLink(token: string): Promise<MagicLinkPayload | null> {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as MagicLinkPayload;
  } catch {
    return null;
  }
}