// @ts-nocheck
// FASE 17 — Testes das rotas restantes (§7/§10/§11):
//   * GET /api/whatsapp/accounts        — seletor de contas por operação,
//     SEM segredos na resposta (tokens ficam no banco; só metadados).
//   * GET /api/campaigns/[id]/recipients — resultados REAIS por destinatário,
//     paginados, com isolamento multi-tenant (404 para org alheia).
// Sem Supabase, sem banco, sem Meta: as dependências são mockadas.

import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}));
jest.mock('@/integrations/meta/accounts', () => ({
  listTenantWhatsAppAccounts: jest.fn(),
}));
jest.mock('@/repositories/campaignRepoReal', () => ({
  campaignRepoReal: {
    get: jest.fn(),
    listRecipients: jest.fn(),
  },
}));

const { GET: accountsGET } = require('../../app/api/whatsapp/accounts/route');
const { GET: recipientsGET } = require('../../app/api/campaigns/[id]/recipients/route');

const { getAuthenticatedUser } = require('@/lib/auth');
const { listTenantWhatsAppAccounts } = require('@/integrations/meta/accounts');
const { campaignRepoReal } = require('@/repositories/campaignRepoReal');

function req(path: string) {
  return new NextRequest(`http://localhost${path}`);
}
const USER = { id: 'u1', organizationId: 'org1', role: 'member' };

describe('GET /api/whatsapp/accounts (§7/§11)', () => {
  afterEach(() => jest.resetAllMocks());

  it('401 sem sessão', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
    const res = await accountsGET(req('/api/whatsapp/accounts'));
    expect(res.status).toBe(401);
  });

  it('devolve metadados SEM segredos (nada de tokens/chaves)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(USER);
    (listTenantWhatsAppAccounts as jest.Mock).mockResolvedValue({
      ok: true,
      accounts: [
        {
          id: 'acc-1',
          provider: 'whatsapp',
          displayName: 'Loja Centro',
          phoneNumberId: '1234567890',
          whatsappBusinessAccountId: 'waba-1',
          status: 'CONNECTED',
        },
      ],
      displayNameAvailable: true,
    });
    const res = await accountsGET(req('/api/whatsapp/accounts'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.available).toBe(true);
    expect(data.accounts).toHaveLength(1);
    const a = data.accounts[0];
    expect(a.displayName).toBe('Loja Centro');
    expect(a.phoneNumberId).toBe('1234567890');
    // A resposta nunca expõe credenciais (seção 5: tokens cifrados server-side).
    expect(JSON.stringify(data)).not.toMatch(/token|secret|key/i);
  });

  it('degradação honesta: sem clientes Supabase → available=false (não inventa)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(USER);
    (listTenantWhatsAppAccounts as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'client_unavailable',
    });
    const res = await accountsGET(req('/api/whatsapp/accounts'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.available).toBe(false);
    expect(data.accounts).toEqual([]);
    expect(data.reason).toBe('client_unavailable');
  });
});

describe('GET /api/campaigns/[id]/recipients (§10)', () => {
  afterEach(() => jest.resetAllMocks());

  it('401 sem sessão', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
    const res = await recipientsGET(req('/api/campaigns/c1/recipients'), { params: { id: 'c1' } });
    expect(res.status).toBe(401);
  });

  it('404 para campanha de outra org (isolamento multi-tenant)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(USER);
    (campaignRepoReal.get as jest.Mock).mockResolvedValue(null);
    const res = await recipientsGET(req('/api/campaigns/cX/recipients'), { params: { id: 'cX' } });
    expect(res.status).toBe(404);
    // A org usada na query é a do usuário autenticado, nunca a do cliente.
    expect(campaignRepoReal.get).toHaveBeenCalledWith('org1', 'cX');
  });

  it('status fora do domínio → 400 invalid_status', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(USER);
    (campaignRepoReal.get as jest.Mock).mockResolvedValue({ id: 'c1', status: 'running' });
    (campaignRepoReal.listRecipients as jest.Mock).mockResolvedValue({ items: [], total: 0 });
    const res = await recipientsGET(
      req('/api/campaigns/c1/recipients?status=hacked'),
      { params: { id: 'c1' } },
    );
    expect(res.status).toBe(400);
    expect(campaignRepoReal.listRecipients).not.toHaveBeenCalled();
  });

  it('lista resultados REAIS por destinatário (paginado + filtro)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(USER);
    (campaignRepoReal.get as jest.Mock).mockResolvedValue({ id: 'c1', status: 'running' });
    (campaignRepoReal.listRecipients as jest.Mock).mockResolvedValue({
      items: [
        {
          contactId: 'ct-1',
          name: 'Maria',
          phone: '+5511999998888',
          status: 'sent',
          attempts: 1,
          externalMessageId: 'wamid.EXEMPLO',
          lastError: null,
          sentAt: '2026-10-21T12:00:00Z',
          createdAt: '2026-10-21T10:00:00Z',
        },
      ],
      total: 42,
    });
    const res = await recipientsGET(
      req('/api/campaigns/c1/recipients?status=sent&limit=5&offset=10'),
      { params: { id: 'c1' } },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(42);
    expect(data.limit).toBe(5);
    expect(data.offset).toBe(10);
    expect(data.items[0].externalMessageId).toBe('wamid.EXEMPLO');
    expect(campaignRepoReal.listRecipients).toHaveBeenCalledWith('org1', 'c1', {
      status: 'sent',
      limit: 5,
      offset: 10,
    });
  });

  it('limit acima do teto é limitado a 100 (defesa em profundidade)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(USER);
    (campaignRepoReal.get as jest.Mock).mockResolvedValue({ id: 'c1', status: 'running' });
    (campaignRepoReal.listRecipients as jest.Mock).mockResolvedValue({ items: [], total: 0 });
    await recipientsGET(req('/api/campaigns/c1/recipients?limit=99999'), { params: { id: 'c1' } });
    expect(campaignRepoReal.listRecipients).toHaveBeenCalledWith('org1', 'c1', {
      status: undefined,
      limit: 100,
      offset: 0,
    });
  });
});
