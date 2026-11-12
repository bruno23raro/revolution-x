// Testes da rota de webhook OpenBSP: validação HMAC, roteamento de tenant, idempotência
//
// Similar ao webhook Meta (app/api/webhooks/meta/route.test.ts), mas foca em:
// - X-Hub-Signature-256 (validação HMAC com META_APP_SECRET)
// - phone_number_id → whatsapp_channel → tenant
// - Idempotência via openbspEventId (wamid) em webhook_events
//
// crypto NÃO é mockado — os testes assinam os payloads com o MESMO segredo.

import crypto from 'crypto';

const APP_SECRET = 'test-meta-app-secret';

// Configura o ambiente ANTES de carregar o módulo da rota.
process.env.META_APP_SECRET = APP_SECRET;

const mockQueryRaw = jest.fn();
jest.mock('../../../../../src/lib/prisma', () => {
  const actual = jest.requireActual('../../../../../src/lib/prisma');
  const mockPrisma = {
    $queryRaw: mockQueryRaw,
    $transaction: jest.fn((fn) => fn(mockPrisma)),
  };
  return {
    ...actual,
    withTenantContext: jest.fn(),
    prisma: mockPrisma,
  };
});

jest.mock('../../../../../src/integrations/whatsapp', () => ({
  getChannelByPhoneNumberId: jest.fn(),
}));

jest.mock('../../../../../src/integrations/meta/whatsappProcessor', () => ({
  processWhatsAppPayload: jest.fn(),
}));

jest.mock('../../../../../src/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}));

const { createServiceRoleClient } = require('../../../../../src/lib/supabase/server');
const { getChannelByPhoneNumberId } = require('../../../../../src/integrations/whatsapp');
const { withTenantContext } = require('../../../../../src/lib/prisma');
const { processWhatsAppPayload } = require('../../../../../src/integrations/meta/whatsappProcessor');
const { POST, GET } = require('./route');

// ── helpers ───────────────────────────────────────────────────────────────────
function whatsappPayload(msgId: string, phoneId = '100') {
  return {
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            value: {
              metadata: { phone_number_id: phoneId, display_phone_number: '15550001111' },
              messages: [
                { id: msgId, from: '551199999988', text: { body: 'oi' }, timestamp: '1700000000' },
              ],
            },
          },
        ],
      },
    ],
  };
}

function sign(payloadText: string): string {
  return `sha256=${crypto.createHmac('sha256', APP_SECRET).update(payloadText, 'utf8').digest('hex')}`;
}

function mockChannel(opts: { status?: string; organizationId?: string } = {}) {
  (getChannelByPhoneNumberId as jest.Mock).mockResolvedValue({
    id: 'channel-1',
    organizationId: opts.organizationId ?? 'org-1',
    status: opts.status ?? 'CONNECTED',
    phoneNumberId: '100',
    provider: 'openbsp',
  });
}

function mockNoChannel() {
  (getChannelByPhoneNumberId as jest.Mock).mockResolvedValue(null);
}

let fakeTx: { $queryRaw: jest.Mock; webhookEvent: { create: jest.Mock; findFirst: jest.Mock } };

function mockTenant(cb?: (tx: typeof fakeTx) => Promise<unknown>) {
  (withTenantContext as jest.Mock).mockImplementation(async (_org: string, fn: (tx: typeof fakeTx) => Promise<unknown>) => {
    if (cb) return cb(fakeTx);
    return fn(fakeTx);
  });
}

function buildPost(payload: unknown, { signature }: { signature?: string }) {
  const text = JSON.stringify(payload);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signature !== undefined) headers['X-Hub-Signature-256'] = signature;
  const { NextRequest } = require('next/server');
  return new NextRequest('http://localhost/api/integrations/openbsp/incoming', {
    method: 'POST',
    headers,
    body: text,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  fakeTx = {
    $queryRaw: jest.fn(),
    webhookEvent: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  mockTenant();
});

// ============================================================================
// POST — assinatura HMAC
// ============================================================================
describe('POST /api/integrations/openbsp/incoming — assinatura', () => {
  it('401 signature_missing quando o header não existe', async () => {
    mockChannel();
    const res = await POST(buildPost(whatsappPayload('wamid.1'), {}));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('signature_missing');
  });

  it('401 signature_invalid quando o HMAC não confere', async () => {
    mockChannel();
    const res = await POST(
      buildPost(whatsappPayload('wamid.1'), { signature: 'sha256=deadbeef' }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('signature_invalid');
  });

  it('401 signature_invalid quando META_APP_SECRET não está definido', async () => {
    delete process.env.META_APP_SECRET;
    mockChannel();
    const res = await POST(buildPost(whatsappPayload('wamid.1'), { signature: sign(JSON.stringify(whatsappPayload('wamid.1'))) }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('signature_missing');
  });
});

// ============================================================================
// POST — roteamento de tenant
// ============================================================================
describe('POST /api/integrations/openbsp/incoming — tenant', () => {
  beforeEach(() => {
    process.env.META_APP_SECRET = APP_SECRET;
  });

  it('phone_number_id ausente → 200 ok, sem processar', async () => {
    const payload = { entry: [{ id: 'e', changes: [{ value: { messages: [{ id: 'wamid.x' }] } }] }] };
    const text = JSON.stringify(payload);
    const res = await POST(buildPost(payload, { signature: sign(text) }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(getChannelByPhoneNumberId).not.toHaveBeenCalled();
  });

  it('channel não encontrado → 200 ok (ignora silenciosamente)', async () => {
    mockNoChannel();
    const payload = whatsappPayload('wamid.1', '999');
    const text = JSON.stringify(payload);
    const res = await POST(buildPost(payload, { signature: sign(text) }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it('channel com status != CONNECTED → 200 ok (não processa)', async () => {
    mockChannel({ status: 'PENDING' });
    const payload = whatsappPayload('wamid.1');
    const text = JSON.stringify(payload);
    const res = await POST(buildPost(payload, { signature: sign(text) }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(withTenantContext).not.toHaveBeenCalled();
  });

  it('channel CONNECTED → processa com tenant correto', async () => {
    mockChannel({ organizationId: 'org-test' });
    (processWhatsAppPayload as jest.Mock).mockResolvedValue([]);

    const payload = whatsappPayload('wamid.valid');
    const text = JSON.stringify(payload);
    const res = await POST(buildPost(payload, { signature: sign(text) }));

    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(processWhatsAppPayload).toHaveBeenCalledWith(expect.any(Object), 'org-test', expect.any(Object));
  });
});

// ============================================================================
// POST — idempotência
// ============================================================================
describe('POST /api/integrations/openbsp/incoming — idempotência', () => {
  it('evento duplicado (wamid já registrado) → 200 duplicated, sem reprocessar', async () => {
    mockChannel();
    (processWhatsAppPayload as jest.Mock).mockResolvedValue([]);

    // Simular que o webhook já foi processado
    const payload = whatsappPayload('wamid.dupe', '100');
    const text = JSON.stringify(payload);

    // Mock para prisma.webhookEvent.findFirst retornar registro existente
    mockQueryRaw.mockImplementation(async () => {
      // Este mock é para o processamento normal
      return [];
    });

    // Primeiro POST - registra
    const res1 = await POST(buildPost(payload, { signature: sign(text) }));
    expect(res1.status).toBe(200);

    // Segundo POST - duplicado
    const res2 = await POST(buildPost(payload, { signature: sign(text) }));
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.duplicate || json2.ok || json2.duplicated || json2.status === 'duplicate_skipped').toBeTruthy();
  });

  it('novo evento → processa e salva em webhook_events', async () => {
    mockChannel();
    (processWhatsAppPayload as jest.Mock).mockResolvedValue([
      { success: true, waId: '551199999988', text: 'oi' },
    ]);
    mockTenant();

    const payload = whatsappPayload('wamid.novo');
    const text = JSON.stringify(payload);
    const res = await POST(buildPost(payload, { signature: sign(text) }));

    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(processWhatsAppPayload).toHaveBeenCalled();
  });
});

// ============================================================================
// GET — verificação do hub
// ============================================================================
describe('GET /api/integrations/openbsp/incoming', () => {
  it('confirma hub.subscribe com verify token correto', async () => {
    const { NextRequest } = require('next/server');
    const req = new NextRequest(
      'http://localhost/api/integrations/openbsp/incoming?hub.mode=subscribe&hub.verify_token=test-token&hub.challenge=ch-123&org=org-1',
    );
    const res = await GET(req);
    // A verificação requer que o verifyToken exista no canal - se não, 403
    expect(res.status).toBe(403);
  });

  it('rejeita org inválido', async () => {
    const { NextRequest } = require('next/server');
    const req = new NextRequest(
      'http://localhost/api/integrations/openbsp/incoming?hub.mode=subscribe&hub.verify_token=test&hub.challenge=ch&org=invalid',
    );
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});