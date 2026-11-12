// Testes do cron de refresh de token OpenBSP

import { POST, GET } from './route';
import { NextRequest } from 'next/server';

// Mocks no escopo módulo
const mockOpenbspConfig = jest.fn();
const mockFetchConnectedAddress = jest.fn();
const mockCreateServiceRoleClient = jest.fn();

jest.mock('@/integrations/whatsapp/openbsp/client', () => ({
  openbspConfig: () => mockOpenbspConfig(),
  fetchConnectedAddress: (...args: any[]) => mockFetchConnectedAddress(...args),
}));

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => mockCreateServiceRoleClient(),
}));

const mockConfig = {
  base: 'https://test.supabase.co/rest/v1',
  publishableKey: 'test-key',
  apiKey: 'test-api-key',
  orgId: 'org-123',
};

const mockCheckedChannel = {
  id: 'channel-123',
  user_id: 'org-123',
  meta: { openbsp_onboarding_token_id: 'token-123' },
  expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = 'test-secret';

  // Defaults
  mockOpenbspConfig.mockReturnValue(mockConfig);
  mockFetchConnectedAddress.mockResolvedValue({
    ok: true,
    data: {
      address: '123456789',
      extra: { access_token: 'token', waba_id: 'waba' },
    },
  });
});

describe('POST /api/cron/openbsp-refresh', () => {
  it('200 com canais vazios', async () => {
    mockCreateServiceRoleClient.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    });

    const res = await POST(
      new NextRequest('http://localhost/api/cron/openbsp-refresh', {
        method: 'POST',
        headers: { 'x-cron-secret': 'test-secret' },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.checked).toBe(0);
  });

  it('200 com token expirado', async () => {
    const expiredChannel = {
      id: 'channel-expired',
      user_id: 'org-123',
      meta: { openbsp_onboarding_token_id: 'token-expired' },
      expires_at: new Date(Date.now() - 1000).toISOString(), // Expirado
    };

    mockFetchConnectedAddress.mockResolvedValue({
      ok: true,
      data: {
        address: '123456789',
        extra: { access_token: 'token', waba_id: 'waba' },
      },
    });

    mockCreateServiceRoleClient.mockReturnValue({
      from: jest.fn().mockImplementation((tableName: string) => {
        if (tableName === 'integrations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({ data: [expiredChannel], error: null }),
                }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return { select: jest.fn(), update: jest.fn() };
      }),
    });

    const res = await POST(
      new NextRequest('http://localhost/api/cron/openbsp-refresh', {
        method: 'POST',
        headers: { 'x-cron-secret': 'test-secret' },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    // Token expirado gera erro mas ok=true porque o erro é reportado em errors[]
    expect(json.checked).toBe(1);
    expect(json.errors).toContainEqual(expect.stringContaining('token_expired'));
  });

  it('200 com sucesso', async () => {
    mockFetchConnectedAddress.mockResolvedValue({
      ok: true,
      data: {
        address: '123456789',
        extra: {
          access_token: 'new-token',
          waba_id: 'waba-123',
          verified_name: 'Test',
        },
      },
    });

    mockCreateServiceRoleClient.mockReturnValue({
      from: jest.fn().mockImplementation((tableName: string) => {
        if (tableName === 'integrations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({ data: [mockCheckedChannel], error: null }),
                }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return { select: jest.fn(), update: jest.fn() };
      }),
    });

    const res = await POST(
      new NextRequest('http://localhost/api/cron/openbsp-refresh', {
        method: 'POST',
        headers: { 'x-cron-secret': 'test-secret' },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.checked).toBe(1);
  });
});

describe('GET /api/cron/openbsp-refresh', () => {
  it('405 method_not_allowed', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    const json = await res.json();
    expect(json.error).toBe('method_not_allowed');
    expect(json.detail).toContain('POST');
  });
});