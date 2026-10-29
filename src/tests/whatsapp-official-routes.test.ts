// @ts-nocheck
// PASSO G — Testes de rota do WhatsApp OFICIAL (OpenBSP).
// Gates cobertos aqui: 401 sem sessao em TODAS as rotas; 503 honesto sem
// OPENBSP_ORG_ID; 403 silencioso no webhook com verify_token errado (gate 4);
// 404 no disconnect sem canal. Sem rede, sem Meta.
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: jest.fn(() => ({})) }));
jest.mock('@/integrations/whatsapp', () => ({
  getChannelDecrypted: jest.fn(),
  getChannelByPhoneNumberId: jest.fn(),
  openbspConfig: jest.fn(() => ({})),
  mintOnboardingToken: jest.fn(),
  fetchConnectedAddress: jest.fn(),
}));
jest.mock('../../src/integrations/whatsapp', () => ({
  getChannelDecrypted: jest.fn(),
  getChannelByPhoneNumberId: jest.fn(),
  openbspConfig: jest.fn(() => ({})),
  mintOnboardingToken: jest.fn(),
  fetchConnectedAddress: jest.fn(),
}));

const { getAuthenticatedUser } = require('@/lib/auth');
const { getChannelDecrypted } = require('../../src/integrations/whatsapp');

const ROUTES = {
  connect: () => require('../../app/api/integrations/openbsp/connect/route').POST,
  callback: () => require('../../app/api/integrations/openbsp/callback/route').GET,
  status: () => require('../../app/api/integrations/whatsapp-official/status/route').GET,
  templatesGet: () => require('../../app/api/integrations/whatsapp-official/templates/route').GET,
  disconnect: () => require('../../app/api/integrations/whatsapp-official/disconnect/route').POST,
};

const USER = { id: 'user-1', email: 'u@x.com', organizationId: 'org-1', role: 'owner' };

function req(url, init) {
  return new NextRequest('http://localhost' + url, init);
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://sb.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-key';
  process.env.META_TOKEN_ENCRYPTION_KEY = 'x'.repeat(32);
  delete process.env.OPENBSP_ORG_ID;
  delete process.env.OPENBSP_API_KEY;
  delete process.env.OPENBSP_BASE_URL;
  delete process.env.OPENBSP_PUBLISHABLE_KEY;
});

describe('rotas whatsapp oficial — autenticacao', () => {
  it.each(Object.keys(ROUTES))('%s devolve 401 sem sessao', async (name) => {
    getAuthenticatedUser.mockResolvedValue(null);
    const handler = ROUTES[name]();
    const res = await handler(req('/x', name === 'connect' || name === 'disconnect' ? { method: 'POST' } : undefined));
    expect(res.status).toBe(401);
  });
});

describe('connect', () => {
  it('503 honesto sem OPENBSP_ORG_ID (nao finge popup)', async () => {
    getAuthenticatedUser.mockResolvedValue(USER);
    const res = await ROUTES.connect()(req('/x', { method: 'POST' }));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'openbsp_not_configured' });
  });
});

describe('disconnect', () => {
  it('404 quando o tenant nunca teve canal', async () => {
    getAuthenticatedUser.mockResolvedValue(USER);
    getChannelDecrypted.mockResolvedValue(null);
    const res = await ROUTES.disconnect()(req('/x', { method: 'POST' }));
    expect(res.status).toBe(404);
  });
});

describe('webhook incoming — verify_token (gate 4)', () => {
  it('403 silencioso com org inexistente (sem oracle de existencia)', async () => {
    const { GET } = require('../../app/api/integrations/openbsp/incoming/route');
    // prisma lancarao (sem DB no teste) -> caminho de erro deve dar 403, nao 500
    const url =
      'http://localhost/api/integrations/openbsp/incoming?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=123&org=11111111-1111-4111-8111-111111111111';
    const res = await GET(req(url));
    expect(res.status).toBe(403);
  });

  it('403 quando falta org ou mode errado', async () => {
    const { GET } = require('../../app/api/integrations/openbsp/incoming/route');
    const res = await GET(req('http://localhost/x?hub.mode=unsubscribe&hub.verify_token=t&hub.challenge=1&org=11111111-1111-4111-8111-111111111111'));
    expect(res.status).toBe(403);
    const res2 = await GET(req('http://localhost/x?hub.mode=subscribe&hub.verify_token=t&hub.challenge=1'));
    expect(res2.status).toBe(403);
  });
});
