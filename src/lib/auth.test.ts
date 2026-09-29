import { hashPassword, verifyPassword, isPasswordStrong, generateToken, verifyToken } from './auth';
import { requireTenant } from '../services/tenant';
import { defaultGrants, requirePermission } from '../services/rbac';

describe('auth security', () => {
  it('rejects weak passwords', () => {
    expect(isPasswordStrong('weak')).toBe(false);
    expect(isPasswordStrong('Strong123')).toBe(true);
  });
  it('hashes without storing plaintext', async () => {
    const password = 'Strong123';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('Wrong123', hash)).toBe(false);
  });
  it('rejects invalid token', () => {
    expect(verifyToken('invalid', 'test-secret')).toBeNull();
  });
  it('validates a signed token', () => {
    const token = generateToken({ sub: 'user-a' }, 'test-secret');
    expect(verifyToken(token, 'test-secret')).toMatchObject({ sub: 'user-a' });
  });
});

describe('tenant isolation and RBAC', () => {
  const tenantA = { userId: 'user-a', organizationId: 'org-a', role: 'owner' };
  it('allows current organization', () => {
    expect(requireTenant(tenantA, 'org-a')).toEqual(tenantA);
  });
  it('denies another organization (IDOR)', () => {
    expect(() => requireTenant(tenantA, 'org-b')).toThrow('Organization access denied');
  });
  it('allows granted permission', () => {
    expect(requirePermission(tenantA, 'members.create', defaultGrants)).toEqual(tenantA);
  });
  it('denies ungranted permission', () => {
    expect(() => requirePermission({ ...tenantA, role: 'member' }, 'billing.manage', defaultGrants)).toThrow();
  });
});
