import { randomBytes } from 'crypto';
import { hashPassword, isPasswordStrong, verifyPassword, generateToken } from '../lib/auth';
import { userRepo } from '../repositories/userRepo';

export type PublicUser = { id: string; email: string; name: string; email_verified: boolean };
export type AuthResult = { user: PublicUser; token: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tokenSecret = () => process.env.JWT_SECRET || '';

function publicUser(user: { id: string; email: string; name: string; email_verified: boolean }): PublicUser {
  return { id: user.id, email: user.email, name: user.name, email_verified: user.email_verified };
}

export function validateRegistration(name: string, email: string, password: string): string[] {
  const errors: string[] = [];
  if (!name.trim()) errors.push('name_required');
  if (!emailPattern.test(email)) errors.push('invalid_email');
  if (!isPasswordStrong(password)) errors.push('weak_password');
  return errors;
}

export async function registerUser(name: string, email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const errors = validateRegistration(name, normalizedEmail, password);
  if (errors.length) throw new Error(errors.join(','));
  const existing = await userRepo.findByEmail(normalizedEmail);
  if (existing) throw new Error('email_already_registered');
  const user = await userRepo.create({
    id: randomBytes(16).toString('hex'), email: normalizedEmail, name: name.trim(),
    password_hash: await hashPassword(password), email_verified: false,
  });
  if (!user) throw new Error('database_not_configured');
  if (!tokenSecret()) throw new Error('jwt_secret_not_configured');
  return { user: publicUser(user), token: generateToken({ sub: user.id }, tokenSecret()) };
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const user = await userRepo.findByEmail(email.trim().toLowerCase());
  if (!user || !(await verifyPassword(password, user.password_hash))) throw new Error('invalid_credentials');
  if (!tokenSecret()) throw new Error('jwt_secret_not_configured');
  return { user: publicUser(user), token: generateToken({ sub: user.id }, tokenSecret()) };
}

export function createRecoveryToken(): string { return randomBytes(32).toString('hex'); }
export function createVerificationToken(): string { return randomBytes(32).toString('hex'); }
