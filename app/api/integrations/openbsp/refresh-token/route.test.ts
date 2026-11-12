// Testes do endpoint de refresh de token OpenBSP

import { POST } from './route';
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '@/lib/auth';
import { openbspConfig, fetchConnectedAddress } from '@/integrations/whatsapp/openbsp/client';

// Mocks escopo módulo - chamados TOP-LEVEL
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/auth');
jest.mock('@/integrations/whatsapp/openbsp/client');

// Instâncias mocking
const mockCreateServiceRoleClient = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetAllOrganizationMemberships = getAllOrganizationMemberships as jest.MockedFunction<typeof getAllOrganizationMemberships>;
const mockOpenbspConfig = openbspConfig as jest.MockedFunction<typeof openbspConfig>;
const mockFetchConnectedAddress = fetchConnectedAddress as jest.MockedFunction<typeof fetchConnectedAddress>;

const mockUser = {
  id: 'user-123',
  organizationId: 'org-123',
  email: 'test@example.com',
  role: 'admin',
};

const mockChannel = {
  id: 'channel-123',
  user_id: 'org-123',
  meta: { openbsp_onboarding_token_id: 'token-123' },
  external_account_id: 'waba-123',
  expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
};

function makeChain(integrations: any[], updateError: any = null) {
  // Simula: from('integrations').select('fields').eq(q).eq(w).eq(e).eq(r) -> { data: [...] }
  // O fluxo real é: .eq('user_id', ...).eq('channel', ...).eq('status', ...).eq('provider', ...)
  // Cada .eq() retorna um objeto com .eq() até o último que retorna { data: [...] }
  const mockChainResult = { data: integrations };

  // Cria os objetos de cadeia com métodos eq
  const eq4 = { eq: jest.fn().mockReturnValue(mockChainResult) };
  const eq3 = { eq: jest.fn().mockReturnValue(eq4) };
  const eq2 = { eq: jest.fn().mockReturnValue(eq3) };
  const eq1 = jest.fn().mockReturnValue(eq2);

  mockCreateServiceRoleClient.mockReturnValue({
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'integrations') {
        return {
          select: jest.fn().mockImplementation((_fields: string) => ({
            // select retorna um objeto com eq() que inicia a cadeia
            eq: eq1,
          })),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: updateError }),
          }),
        };
      }
      return {
        select: jest.fn().mockImplementation((_fields: string) => ({
          eq: eq1,
        })),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: updateError || null }),
        }),
      };
    }),
  });
}

describe('POST /api/integrations/openbsp/refresh-token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';

    // Defaults
    mockGetAuthenticatedUser.mockImplementation(() => Promise.resolve(null));
    mockGetAllOrganizationMemberships.mockImplementation(() => Promise.resolve([{ organizationId: 'org-123', role: 'admin' }]));
    mockOpenbspConfig.mockReturnValue({
      base: 'https://api.openbsp.com',
      apiKey: 'test-key',
      publishableKey: 'test-pub-key',
    });
    mockFetchConnectedAddress.mockResolvedValue({
      ok: true,
      data: {
        address: '5511888887777',
        extra: { access_token: 'new-access-token', waba_id: 'waba-123' },
      },
    });
  });

  function req(): NextRequest {
    return new NextRequest('http://localhost/api/integrations/openbsp/refresh-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
  }

  it('401 quando usuário não autenticado', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('409 quando canal não conectado', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce(mockUser);
    makeChain([]);
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'not_connected' });
  });

  it('503 quando config OpenBSP ausente', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce(mockUser);
    mockOpenbspConfig.mockReturnValueOnce(null);
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'config_missing' });
  });

  it('200 com sucesso - token verificado', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce(mockUser);
    makeChain([mockChannel]);
    const res = await POST(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.tokenId).toBeDefined();
  });

  it('409 quando token expirado', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce(mockUser);
    const expired = { ...mockChannel, expires_at: new Date(Date.now() - 1000).toISOString() };
    makeChain([expired]);
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'token_expired', detail: 'onboarding expirou' });
  });

  it('502 quando fetch OpenBSP falha', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce(mockUser);
    makeChain([mockChannel]);
    mockFetchConnectedAddress.mockResolvedValueOnce({ ok: false, errorDetail: 'API error' });
    const res = await POST(req());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'fetch_failed', detail: 'API error' });
  });

  it('409 quando access_token ausente no provedor', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce(mockUser);
    makeChain([mockChannel]);
    mockFetchConnectedAddress.mockResolvedValueOnce({
      ok: true,
      data: { address: '5511888887777', extra: {} },
    });
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'token_revoked', detail: 'access_token ausente no provedor' });
  });

  it('500 quando erro no banco de dados', async () => {
    mockGetAuthenticatedUser.mockResolvedValueOnce(mockUser);
    makeChain([mockChannel], { message: 'DB connection failed' });
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'db_error' });
  });
});
