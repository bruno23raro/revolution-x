import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { createClient } from './supabase/server';
import { prisma, withUserContext } from './prisma';
import * as log from './logger';

// ============================================================
// Auth helpers — works without DB for token-based validation
// ============================================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
export function generateToken(payload: object, secret: string, expiresIn: string = '7d'): string {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as SignOptions['expiresIn'] });
}
export function verifyToken(token: string, secret: string): object | null {
  try {
    return jwt.verify(token, secret) as object;
  } catch {
    return null;
  }
}
export function isPasswordStrong(pw: string): boolean {
  return pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw);
}

// ============================================================
// User + Organization membership
// ============================================================

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  organizationId: string;
  role: string;
  /** Todas as memberships do usuário (para autorização completa). */
  organizationMembers?: Array<{ organizationId: string; role: string }>;
}

/**
 * Lazy auth: only validates session when explicitly called.
 * Unlike getAuthenticatedUser which eagerly fetches on every call,
 * this function checks if a session exists and returns user data
 * only when the caller explicitly requests it.
 *
 * Callers should use this only when they need the authenticated user,
 * and public routes should NOT call this function.
 */
export async function getAuth(
  req: NextRequest
): Promise<{ user: AuthenticatedUser | null; hasSession: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user && !session) {
    // No session at all - return early without DB query
    return { user: null, hasSession: false };
  }

  if (!user) {
    // Has session but no user (e.g., email unconfirmed)
    return { user: null, hasSession: true };
  }

  // Validate user exists in the database and belongs to an organization.
  // Wrapped in withUserContext so the "User_self" RLS policy is satisfied.
  // (Currently BYPASSRLS ignores this, but future-proof for role migration.)
  let dbUser;
  try {
    dbUser = await withUserContext(user.id, async (tx) =>
      tx.user.findUnique({
        where: { id: user.id },
        include: { organizationMembers: true },
      })
    );
  } catch (err) {
    // Log: erro de banco de dados — APENAS nome e código, sem dados pessoais
    const e = err instanceof Error ? err : new Error(String(err));
    log.error('[auth] getAuth: database error', e, {
      code: (e as { code?: string }).code,
      name: e.name
    });
    return { user: null, hasSession: true };
  }

  if (!dbUser) {
    // Log: usuário sem registro no banco de dados
    log.info('[auth] getAuth: user not found in database');
    return { user: null, hasSession: true };
  }

  if (dbUser.organizationMembers.length === 0) {
    // Log: usuário sem membership em nenhuma organização
    log.info('[auth] getAuth: user has no organization memberships');
    return { user: null, hasSession: true };
  }

  // Return the first (primary) organization membership for organizationId/organization rollback.
  const primary = dbUser.organizationMembers[0];

  // O role reflete a organização primária (orgMembers[0]).
  // Se o usuário for admin/owner na org primária, role = admin/owner.
  // Se for admin só em outras orgs, o role permanece como o da org primária,
  // preservando o isolamento multi-tenant: não eleva privilégios fora da org ativa.
  const primaryRole = primary.role;
  const effectiveRole = primaryRole;

  return {
    user: {
      id: user.id,
      email: user.email || null,
      organizationId: primary.organizationId,
      role: effectiveRole,
    },
    hasSession: true,
  };
}

/**
 * Convenience: returns just the user (backward compatible).
 * Deprecated: use getAuth() for lazy authentication.
 * @deprecated Use getAuth() instead for on-demand auth
 */
export async function getAuthenticatedUser(
  req: NextRequest
): Promise<AuthenticatedUser | null> {
  const { user } = await getAuth(req);
  return user;
}

// Returns ALL organizations the authenticated user belongs to (including role).
// Used by routes that need to validate a specific org beyond the primary.
export async function getAllOrganizationMemberships(
  _req: NextRequest
): Promise<Array<{ organizationId: string; role: string }> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Wrap in withUserContext to satisfy User_self RLS policy.
  let dbUser;
  try {
    dbUser = await withUserContext(user.id, async (tx) =>
      tx.user.findUnique({
        where: { id: user.id },
        include: { organizationMembers: { select: { organizationId: true, role: true } } },
      })
    );
  } catch (err) {
    // Log: erro de banco de dados — APENAS nome e código, sem dados pessoais
    const e = err instanceof Error ? err : new Error(String(err));
    log.error('[auth] getAllOrganizationMemberships: database error', e, {
      code: (e as { code?: string }).code,
      name: e.name
    });
    return null;
  }

  if (!dbUser || dbUser.organizationMembers.length === 0) {
    return null;
  }

  return dbUser.organizationMembers;
}

// Validates that the authenticated user has membership in the given organization.
// Returns the full AuthenticatedUser if valid, null otherwise.
export async function requireMembershipIn(
  req: NextRequest,
  organizationId: string
): Promise<AuthenticatedUser | null> {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  // If user's primary org matches, allow
  if (user.organizationId === organizationId) {
    return user;
  }

  // Otherwise, check all memberships
  const memberships = await getAllOrganizationMemberships(req);
  if (!memberships) return null;

  const membership = memberships.find((m) => m.organizationId === organizationId);
  if (!membership) return null;

  return {
    id: user.id,
    email: user.email,
    organizationId: membership.organizationId,
    role: membership.role,
  };
}

// ============================================================
// Owner-only authorization (proper RBAC)
// ============================================================

/**
 * @deprecated Use requireRole(['owner']) instead. Kept for backward compatibility.
 * Legacy: checks if email matches the hardcoded owner email.
 * This is a legacy bypass that will be removed in a future version.
 */
export function isOwnerEmail(email: string | null): boolean {
  return email === 'brunoalmeida23111996@gmail.com';
}

/**
 * Validates that the authenticated user has 'owner' role IN THE TARGET ORGANIZATION.
 * Uses requireRole internally with target organization resolution.
 * Replaces the legacy email-based check with proper RBAC.
 */
export async function requireOwner(
  req: NextRequest
): Promise<{ isOwner: boolean; user: AuthenticatedUser | null }> {
  const user = await requireRole(req, ['owner']);
  return { isOwner: !!user, user };
}

/**
 * Extract target organization from request context.
 * Priority: query param > header > body > primary organization
 */
async function getTargetOrganization(req: NextRequest, user: AuthenticatedUser): Promise<string> {
  // Check query param first
  const queryOrg = req.nextUrl?.searchParams?.get('organizationId');
  if (queryOrg) return queryOrg;

  // Check header
  const headerOrg = req.headers.get('x-organization-id');
  if (headerOrg) return headerOrg;

  // Check body (for POST/PUT/PATCH)
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      const body = await req.clone().json();
      if (body?.organizationId) return body.organizationId;
    } catch {
      // Body not JSON or empty, ignore
    }
  }

  // Fallback to primary organization
  return user.organizationId;
}

// ============================================================
// Role-based authorization helper
// ============================================================

/**
 * Validates that the authenticated user has one of the required roles IN THE TARGET ORGANIZATION.
 *
 * The target organization is determined from request context (query, body, header) or falls back to primary.
 * Authorization is STRICTLY per-organization: a role in org-A does NOT grant access in org-B.
 *
 * Returns the user with target organization context if authorized, null otherwise.
 */
export async function requireRole(
  req: NextRequest,
  allowedRoles: string[]
): Promise<AuthenticatedUser | null> {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;

  // Determine target organization from request context
  const targetOrgId = await getTargetOrganization(req, user);

  // Validate membership AND role in the target organization
  const membershipUser = await requireMembershipIn(req, targetOrgId);
  if (!membershipUser) return null;

  // Check if the role in the target organization is allowed
  if (!allowedRoles.includes(membershipUser.role)) {
    return null;
  }

  // Return user with target organization context
  return membershipUser;
}
