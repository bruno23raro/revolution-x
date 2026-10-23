// @ts-nocheck
// FASE 18 — Testes de rota da IA (§13/§16). Sem rede: os provedores são
// INJETADOS via `setTestProviders` (seam de teste em `@/ai/testSeam`), com
// fetch fake. Nenhum gateway real é chamado; a rota só repassa para o facade,
// que é testado à parte. 401 sem sessão; ok=false + erro honesto (nunca inventa).

import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
}));
jest.mock('@/lib/taskQueue', () => ({
  listMemory: jest.fn().mockResolvedValue([]),
}));

const { GET: modelsGET } = require('../../app/api/ai/models/route');
const { POST: generatePOST } = require('../../app/api/ai/generate/route');
const { getAuthenticatedUser } = require('@/lib/auth');
const { setTestProviders } = require('@/ai/testSeam');

// Provedor fake: configurado, sem rede. `listModels` devolve dados sintéticos.
function fakeProvider(over: Record<string, unknown> = {}) {
  return {
    id: 'fake',
    name: 'Fake',
    configured: true,
    listModels: async () => ({
      models: [
        { id: 'fake-1', name: 'Fake 1', contextWindow: 4096, capabilities: ['chat'] },
        { id: 'fake-2', name: 'Fake 2', contextWindow: 1000000, capabilities: ['chat', 'long_context'] },
      ],
      source: 'api',
      fetchedAt: 1,
    }),
    generate: async () => ({ text: 'resposta', model: 'fake-1' }),
    ...over,
  };
}

function req(path: string, init: RequestInit = {}) {
  return new NextRequest(`http://localhost${path}`, init);
}

describe('GET /api/ai/models', () => {
  afterEach(() => setTestProviders(undefined));

  it('401 sem sessão', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
    const res = await modelsGET(req('/api/ai/models'));
    expect(res.status).toBe(401);
  });

  it('devolve provedores sem segredos (configured booleano, sem apiKey/baseUrl)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'u', organizationId: 'o', role: 'member',
    });
    setTestProviders([fakeProvider()]);
    const res = await modelsGET(req('/api/ai/models'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.providers)).toBe(true);
    for (const p of data.providers) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.configured).toBe('boolean');
      expect(p).not.toHaveProperty('apiKey');
      expect(p).not.toHaveProperty('baseUrl');
      expect(Array.isArray(p.models)).toBe(true);
    }
    expect(data.auto).toBeTruthy();
  });
});

describe('POST /api/ai/generate', () => {
  afterEach(() => setTestProviders(undefined));

  it('401 sem sessão', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
    const res = await generatePOST(req('/api/ai/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'x' }),
    }));
    expect(res.status).toBe(401);
  });

  it('prompt vazio → 400', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'u', organizationId: 'o', role: 'member',
    });
    setTestProviders([fakeProvider()]);
    const res = await generatePOST(req('/api/ai/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: '  ' }),
    }));
    expect(res.status).toBe(400);
  });

  it('provedor ok devolve texto real do provedor fake', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'u', organizationId: 'o', role: 'member',
    });
    setTestProviders([fakeProvider()]);
    const res = await generatePOST(req('/api/ai/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'olá' }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.text).toBe('resposta');
    expect(data.provider).toBe('fake');
  });

  it('sem provedor configurado → BLOQUEADO honesto (nunca inventa)', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'u', organizationId: 'o', role: 'member',
    });
    setTestProviders([{ ...fakeProvider(), configured: false, generate: async () => { throw new Error('sem chave'); } }]);
    const res = await generatePOST(req('/api/ai/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'olá' }),
    }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain('BLOQUEADO');
    expect(data.text).toBeUndefined();
  });
});