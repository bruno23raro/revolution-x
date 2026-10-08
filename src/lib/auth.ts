import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { createClient } from './supabase/server';
import { prisma } from './prisma';

// Abstração de auth — funciona sem DB para validação; usa repository quando disponível
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

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  organizationId: string;
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

  // Validate user exists in the database
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { organizationMembers: true },
  });

  if (!dbUser || dbUser.organizationMembers.length === 0) {
    return null;
  }

  return {
    id: user.id,
    email: user.email || null,
    organizationId: dbUser.organizationMembers[0].organizationId,
  };
}
