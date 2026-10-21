// src/tests/tenant-isolation.test.ts
//
// Regressão de isolamento multi-tenant (escrita): as rotas POST NUNCA confiam
// em organizationId enviado pelo cliente (mass-assignment). A organização da
// linha é SEMPRE a do usuário autenticado (server-derived, via
// getAuthenticatedUser).
//
// Antes do fix, o padrão `repo.create({ organizationId: user.organizationId, ...body })`
// deixava `body.organizationId` sobrescrever o valor do servidor → qualquer
// usuário autenticado plantava registros em OUTRO tenant (contatos, leads,
// deals, produtos). Este teste trava essa propriedade.
//
// Padrão de mocking dinâmico coerente com admin-routes.test.ts / fase1-routes.test.ts.
// @ts-nocheck

import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('@/services/crmService', () => ({
  validateContact: jest.fn(() => []),
  validateLead: jest.fn(() => []),
  validateDeal: jest.fn(() => []),
  validatePipeline: jest.fn(() => []),
}));

jest.mock('@/services/productService', () => ({
  validateProduct: jest.fn(() => []),
}));

jest.mock('@/repositories/crmRepoReal', () => ({
  contactRepoReal: { create: jest.fn().mockResolvedValue({ id: 'c-1' }), findByOrganization: jest.fn() },
  leadRepoReal: { create: jest.fn().mockResolvedValue({ id: 'l-1' }), findByOrganization: jest.fn() },
  dealRepoReal: { create: jest.fn().mockResolvedValue({ id: 'd-1' }), findByOrganization: jest.fn() },
  pipelineRepoReal: { create: jest.fn().mockResolvedValue({ id: 'p-1' }), findByOrganization: jest.fn() },
}));

jest.mock('@/repositories/productRepoReal', () => ({
  productRepoReal: { create: jest.fn().mockResolvedValue({ id: 'pr-1' }), findByOrganization: jest.fn() },
}));

const { getAuthenticatedUser } = require('@/lib/auth');
const {
  contactRepoReal,
  leadRepoReal,
  dealRepoReal,
  pipelineRepoReal,
} = require('@/repositories/crmRepoReal');
const { productRepoReal } = require('@/repositories/productRepoReal');

const { POST: contactPOST } = require('../../app/api/crm/contacts/route');
const { POST: leadPOST } = require('../../app/api/crm/leads/route');
const { POST: dealPOST } = require('../../app/api/crm/deals/route');
const { POST: pipelinePOST } = require('../../app/api/crm/pipelines/route');
const { POST: productPOST } = require('../../app/api/products/route');

// Usuário autenticado: sua org é a ÚNICA que deve receber a escrita.
const USER = { id: 'user-1', email: 'a@x.com', role: 'admin', organizationId: 'org-mine' };
const EVIL = 'org-evil'; // organizationId que o cliente tenta injetar

function post(url, body) {
  return new NextRequest('http://localhost' + url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  getAuthenticatedUser.mockResolvedValue(USER);
});

describe('isolamento multi-tenant em rotas de escrita (POST)', () => {
  it('POST /api/crm/contacts: organizationId do cliente é ignorado', async () => {
    const res = await contactPOST(post('/api/crm/contacts', { name: 'Ana', email: 'ana@x.com', organizationId: EVIL }));
    expect(res.status).toBe(201);
    expect(contactRepoReal.create).toHaveBeenCalledTimes(1);
    expect(contactRepoReal.create).toHaveBeenCalledWith({ organizationId: USER.organizationId, name: 'Ana', email: 'ana@x.com' });
    expect(contactRepoReal.create).not.toHaveBeenCalledWith(expect.objectContaining({ organizationId: EVIL }));
  });

  it('POST /api/crm/leads: organizationId do cliente é ignorado', async () => {
    const res = await leadPOST(post('/api/crm/leads', { status: 'new', source: 'web', organizationId: EVIL }));
    expect(res.status).toBe(201);
    expect(leadRepoReal.create).toHaveBeenCalledTimes(1);
    expect(leadRepoReal.create).toHaveBeenCalledWith({ organizationId: USER.organizationId, status: 'new', source: 'web' });
    expect(leadRepoReal.create).not.toHaveBeenCalledWith(expect.objectContaining({ organizationId: EVIL }));
  });

  it('POST /api/crm/deals: organizationId do cliente é ignorado', async () => {
    const res = await dealPOST(post('/api/crm/deals', { title: 'T', value: 100, organizationId: EVIL }));
    expect(res.status).toBe(201);
    expect(dealRepoReal.create).toHaveBeenCalledTimes(1);
    expect(dealRepoReal.create).toHaveBeenCalledWith({ organizationId: USER.organizationId, title: 'T', value: 100 });
    expect(dealRepoReal.create).not.toHaveBeenCalledWith(expect.objectContaining({ organizationId: EVIL }));
  });

  it('POST /api/products: organizationId do cliente é ignorado', async () => {
    const res = await productPOST(post('/api/products', { name: 'Widget', price: 9, organizationId: EVIL }));
    expect(res.status).toBe(201);
    expect(productRepoReal.create).toHaveBeenCalledTimes(1);
    expect(productRepoReal.create).toHaveBeenCalledWith({ organizationId: USER.organizationId, name: 'Widget', price: 9 });
    expect(productRepoReal.create).not.toHaveBeenCalledWith(expect.objectContaining({ organizationId: EVIL }));
  });

  it('POST /api/crm/pipelines (controle já seguro): continua usando a org do usuário', async () => {
    const res = await pipelinePOST(post('/api/crm/pipelines', { name: 'P1', organizationId: EVIL }));
    expect(res.status).toBe(201);
    expect(pipelineRepoReal.create).toHaveBeenCalledWith({ organizationId: USER.organizationId, name: 'P1', stages: [] });
  });

  it('sem usuário autenticado → 401 e nenhuma escrita', async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    const res = await contactPOST(post('/api/crm/contacts', { name: 'Ana', email: 'ana@x.com' }));
    expect(res.status).toBe(401);
    expect(contactRepoReal.create).not.toHaveBeenCalled();
  });
});
