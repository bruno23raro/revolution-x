// FASE 1 — Registry de provedores (health probe) + configStore (AgentMemory).

import { providerById, providersByLayer, probeProvider, probeMany, PROVIDERS } from '@/integrations/providers';
import {
  saveProviderConfig,
  getProviderConfig,
  clearProviderConfig,
  getProviderStatus,
  saveChatbotConfig,
  getChatbotConfig,
  getChatbotConfigForOrg,
  providerConfigKey,
} from '@/integrations/configStore';

// ---- mocks ----
const mockStore: { data: Map<string, unknown> } = { data: new Map() };
jest.mock('../lib/taskQueue', () => ({
  saveMemory: jest.fn(async (_c: unknown, _s: unknown, _kind: string, key: string, value: unknown) => {
    mockStore.data.set(key, value);
  }),
  listMemory: jest.fn(async () =>
    Array.from(mockStore.data.entries()).map(([key, value]) => ({ kind: 'preference', key, value, updatedAt: new Date() })),
  ),
}));

const SCOPE = { organizationId: 'org1', userId: 'u1' };

function fakeFetch(handler: (url: string, init?: unknown) => unknown): typeof fetch {
  return (async (url: unknown) => handler(typeof url === 'string' ? url : String(url))) as unknown as typeof fetch;
}

function resp(body: unknown, opts: { ok?: boolean; status?: number } = {}) {
  const ok = opts.ok ?? true;
  const s = JSON.stringify(body);
  return { ok, status: opts.status ?? 200, text: async () => s, json: async () => body };
}

function fakeClient(rows: unknown[] = []) {
  return {
    agentMemory: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      findFirst: jest.fn(async () => (rows[0] ? { valueJson: rows[0] } : null)),
    },
  } as unknown as Parameters<typeof clearProviderConfig>[0];
}

// ============================================================
// Registry
// ============================================================

describe('providers — registry', () => {
  it('separa camadas', () => {
    const official = providersByLayer('official');
    const semApi = providersByLayer('sem_api');
    expect(official.some((p) => p.id === 'meta')).toBe(true);
    expect(official.some((p) => p.id === 'n8n')).toBe(true);
    expect(semApi.every((p) => p.riskNote && p.riskNote.length > 0)).toBe(true);
    expect(semApi.some((p) => p.id === 'qr_whatsapp')).toBe(true);
  });

  it('todos "Sem API" têm aviso de risco', () => {
    for (const p of providersByLayer('sem_api')) expect(p.riskNote).toBeTruthy();
  });

  it('busca por id', () => {
    expect(providerById('make')?.name).toBe('Make (Integromat)');
    expect(providerById('inexistente')).toBeUndefined();
  });

  it('registry não tem id duplicado', () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ============================================================
// Health probe
// ============================================================

describe('probeProvider', () => {
  it('endpoint ok', async () => {
    const def = providerById('n8n')!;
    const r = await probeProvider(def, { baseUrl: 'https://n8n.example' }, { fetchImpl: fakeFetch(() => resp({ ok: true })) });
    expect(r.status).toBe('ok');
  });

  it('endpoint com HTTP 401 → error', async () => {
    const def = providerById('n8n')!;
    const r = await probeProvider(def, { baseUrl: 'https://n8n.example' }, {
      fetchImpl: fakeFetch(() => resp({ error: 'no' }, { ok: false, status: 401 })),
    });
    expect(r.status).toBe('error');
    expect(r.detail).toContain('401');
  });

  it('endpoint sem URL → not_configured', async () => {
    const def = providerById('make')!;
    const r = await probeProvider(def, {}, {});
    expect(r.status).toBe('not_configured');
  });

  it('keys: faltando campo obrigatório → not_configured', async () => {
    const def = providerById('resend')!;
    const r = await probeProvider(def, { fromEmail: 'a@b.c' }, {}); // falta apiKey (required)
    expect(r.status).toBe('not_configured');
    expect(r.detail).toContain('apiKey');
  });

  it('keys: completo → ok', async () => {
    const def = providerById('resend')!;
    const r = await probeProvider(def, { apiKey: 're_x', fromEmail: 'a@b.c' }, {});
    expect(r.status).toBe('ok');
  });

  it('sem API → skipped (com aviso)', async () => {
    const def = providerById('qr_whatsapp')!;
    const r = await probeProvider(def, {}, {});
    expect(r.status).toBe('skipped');
    expect(r.detail).toMatch(/sem API/i);
  });

  it('meta (OAuth) sem conexão → not_configured (UI mostra "Conectar")', async () => {
    const r = await probeProvider(providerById('meta')!, null, {});
    expect(r.status).toBe('not_configured');
  });

  it('meta (OAuth) com valor → skipped (não sonda remotamente)', async () => {
    const r = await probeProvider(providerById('meta')!, { connected: true }, {});
    expect(r.status).toBe('skipped');
  });

  it('probeMany não derruba com erro de um', async () => {
    const defs = [providerById('n8n')!, providerById('make')!];
    const values: Record<string, Record<string, unknown> | null> = {
      n8n: { baseUrl: 'https://ok.example' },
      make: null,
    };
    const res = await probeMany(defs, values, { fetchImpl: fakeFetch(() => resp({ ok: true })) });
    expect(res.find((r) => r.provider === 'n8n')?.status).toBe('ok');
    expect(res.find((r) => r.provider === 'make')?.status).toBe('not_configured');
  });
});

// ============================================================
// configStore
// ============================================================

describe('configStore', () => {
  beforeEach(() => mockStore.data.clear());

  it('save + get por provedor', async () => {
    await saveProviderConfig(fakeClient(), SCOPE, 'n8n', { baseUrl: 'https://x', apiKey: 'k' });
    const got = await getProviderConfig(fakeClient(), SCOPE, 'n8n');
    expect(got).toEqual({ baseUrl: 'https://x', apiKey: 'k' });
  });

  it('get ausente → null', async () => {
    expect(await getProviderConfig(fakeClient(), SCOPE, 'make')).toBeNull();
  });

  it('status lista configurado vs não', async () => {
    await saveProviderConfig(fakeClient(), SCOPE, 'n8n', { baseUrl: 'u' });
    const statuses = await getProviderStatus(fakeClient(), SCOPE, ['n8n', 'make']);
    expect(statuses.find((s) => s.provider === 'n8n')?.configured).toBe(true);
    expect(statuses.find((s) => s.provider === 'make')?.configured).toBe(false);
  });

  it('clear remove do providerConfigKey (chama deleteMany)', async () => {
    const client: any = fakeClient();
    await clearProviderConfig(client, SCOPE, 'n8n');
    expect(client.agentMemory.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org1',
          userId: 'u1',
          memoryKey: providerConfigKey('n8n'),
          kind: 'preference',
        }),
      }),
    );
  });

  it('chatbot save/get (user-scoped)', async () => {
    await saveChatbotConfig(fakeClient(), SCOPE, { enabled: true, rules: [] });
    const got = await getChatbotConfig(fakeClient(), SCOPE);
    expect(got).toEqual({ enabled: true, rules: [] });
  });

  it('chatbot leitura org-wide usa findFirst', async () => {
    const client: any = fakeClient([{ enabled: true, rules: [{ x: 1 }] }]);
    const got = await getChatbotConfigForOrg(client, 'org1');
    expect(client.agentMemory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org1', memoryKey: 'chatbot_config' }),
      }),
    );
    expect(got).toEqual({ enabled: true, rules: [{ x: 1 }] });
  });

  it('chatbot org-wide ausente → null', async () => {
    expect(await getChatbotConfigForOrg(fakeClient(), 'org1')).toBeNull();
  });
});
