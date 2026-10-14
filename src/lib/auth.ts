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
}

export async function getAuthenticatedUser(
  _req: NextRequest
): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Validate user exists in the database and belongs to an organization.
  // Wrapped in withUserContext so the "User_self" RLS policy is satisfied.
  // (Currently BYPASSRLS ignores this, but future-proof for role migration.)
  const dbUser = await withUserContext(user.id, async (tx) =>
    tx.user.findUnique({
      where: { id: user.id },
      include: { organizationMembers: true },
    })
  );

  if (!dbUser || dbUser.organizationMembers.length === 0) {
    return null;
  }

  // Return the first (primary) organization membership.
  const primary = dbUser.organizationMembers[0];
  return {
    id: user.id,
    email: user.email || null,
    organizationId: primary.organizationId,
    role: primary.role,
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
  const dbUser = await withUserContext(user.id, async (tx) =>
    tx.user.findUnique({
      where: { id: user.id },
      include: { organizationMembers: { select: { organizationId: true, role: true } } },
    })
  );

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
