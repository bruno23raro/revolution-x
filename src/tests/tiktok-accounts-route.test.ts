// FASE 2 · slice 5 — GET /api/integrations/tiktok (listagem de contas).
//
// Fronteira: auth + prisma + resolveAccess mockados; a rota é REAL.
// Comprova: 401 sem auth; listagem (accounts+count); e a degradação
// honesta (fila indisponível → listTikTokAccounts devolve [] → count 0,
// e NUNCA tokens/segredos vazam).

import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { listTikTokAccounts } from '@/integrations/tiktok/resolveAccess';
import { GET } from '../../app/api/integrations/tiktok/route';

jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: { __prisma: true },
}));
jest.mock('@/integrations/tiktok/resolveAccess', () => ({
  listTikTokAccounts: jest.fn(),
}));

const USER = { id: 'u-1', organizationId: 'org-1', role: 'member' };

beforeEach(() => jest.clearAllMocks());

describe('GET /api/integrations/tiktok', () => {
  it('401 sem autenticação', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/integrations/tiktok'));
    expect(res.status).toBe(401);
    expect(listTikTokAccounts).not.toHaveBeenCalled();
  });

  it('devolve as contas do tenant + count (2 contas)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(USER);
    (listTikTokAccounts as jest.Mock).mockResolvedValue([
      { openId: 'OID_A', source: 'oauth', obtainedAt: '2026-01-01T00:00:00Z', tokenExpired: false },
      { openId: 'OID_B', source: 'manual', obtainedAt: '2026-02-01T00:00:00Z', tokenExpired: false },
    ]);
    const res = await GET(new NextRequest('http://localhost/api/integrations/tiktok'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.accounts).toHaveLength(2);
    expect(body.accounts.map((a: { openId: string }) => a.openId)).toEqual(['OID_A', 'OID_B']);
    // Nunca expõe segredos (o metadado tem `tokenExpired`, mas não tokens).
    const s = JSON.stringify(body);
    expect(s).not.toContain('accessToken');
    expect(s).not.toContain('refreshToken');
    expect(s).not.toContain('clientSecret');
    expect(s).not.toContain('encrypted');
  });

  it('tenant sem contas → count 0, accounts []', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(USER);
    (listTikTokAccounts as jest.Mock).mockResolvedValue([]);
    const res = await GET(new NextRequest('http://localhost/api/integrations/tiktok'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accounts: [], count: 0 });
  });
});
