import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { createClient } from './supabase/server';
import { prisma, withUserContext } from './prisma';

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

export async function getAuthenticatedUser(
  _req: NextRequest
): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Log: sem sessão Supabase (usuário não autenticado)
    console.log('[auth] getAuthenticatedUser: no supabase session');
    return null;
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
  } catch (error) {
    // Log: erro de banco de dados — APENAS nome e código, sem dados pessoais
    const err = error instanceof Error ? error : new Error(String(error));
    console.log('[auth] getAuthenticatedUser: database error, code=' + (err as { code?: string }).code + ', name=' + err.name);
    return null;
  }

  if (!dbUser) {
    // Log: usuário sem registro no banco de dados
    console.log('[auth] getAuthenticatedUser: user not found in database');
    return null;
  }

  if (dbUser.organizationMembers.length === 0) {
    // Log: usuário sem membership em nenhuma organização
    console.log('[auth] getAuthenticatedUser: user has no organization memberships');
    return null;
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
    id: user.id,
    email: user.email || null,
    organizationId: primary.organizationId,
    role: effectiveRole,
  };
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
  } catch (error) {
    // Log: erro de banco de dados — APENAS nome e código, sem dados pessoais
    const err = error instanceof Error ? error : new Error(String(error));
    console.log('[auth] getAllOrganizationMemberships: database error, code=' + (err as { code?: string }).code + ', name=' + err.name);
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
