import { hashPassword, verifyPassword, isPasswordStrong, generateAccessToken, verifyAccessToken, generateRefreshToken, verifyRefreshToken } from './auth';
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
  it('rejects invalid access token', () => {
    expect(verifyAccessToken('invalid')).toBeNull();
  });
  it('validates a signed access token', () => {
    const token = generateAccessToken({ sub: 'user-a' });
    expect(verifyAccessToken(token)).toMatchObject({ sub: 'user-a' });
  });
  it('rejects invalid refresh token', () => {
    expect(verifyRefreshToken('invalid')).toBeNull();
  });
  it('validates a signed refresh token', () => {
    const token = generateRefreshToken({ sub: 'user-a' });
    expect(verifyRefreshToken(token)).toMatchObject({ sub: 'user-a' });
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