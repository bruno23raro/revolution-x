// app/api/webhooks/meta/route.test.ts
// Testes da rota de webhook Meta: verificação do hub, HMAC, idempotência
// (fast-path service_role + claim atômico com ON CONFLICT) e resolução de tenant.
//
// crypto NÃO é mockado — a rota usa HMAC-SHA256 real e o teste assina os
// payloads com o MESMO segredo para validar verifySignature de verdade.
// A rota captura META_APP_SECRET / META_WEBHOOK_VERIFY_TOKEN no módulo, então
// o process.env precisa ser definido ANTES do require('./route').

import crypto from 'crypto';

const APP_SECRET = 'test-meta-app-secret';
const VERIFY_TOKEN = 'test-verify-token';

// Configura o ambiente ANTES de carregar o módulo da rota.
process.env.META_APP_SECRET = APP_SECRET;
process.env.META_WEBHOOK_VERIFY_TOKEN = VERIFY_TOKEN;

// ── mocks de fronteira ───────────────────────────────────────────────────────
jest.mock('@/lib/prisma', () => ({
  withTenantContext: jest.fn(),
}));

jest.mock('@/integrations/meta', () => ({
  sanitizeWebhookPayload: jest.fn((p: unknown) => p),
  processWhatsAppPayload: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}));

const { createServiceRoleClient } = require('@/lib/supabase/server');
const { withTenantContext } = require('@/lib/prisma');
const { processWhatsAppPayload } = require('@/integrations/meta');
const { POST, GET } = require('./route');

// ── helpers ───────────────────────────────────────────────────────────────────
const whatsappPayload = (msgId: string, phoneId = '100') => ({
  entry: [
    {
      id: 'entry-1',
      changes: [
        {
          value: {
            metadata: { phone_number_id: phoneId, display_phone_number: '15550001111' },
            messages: [
              { id: msgId, from: '551199999', text: { body: 'oi' }, timestamp: '1700000000' },
            ],
          },
        },
      ],
    },
  ],
});

function sign(payloadText: string): string {
  return `sha256=${crypto.createHmac('sha256', APP_SECRET).update(payloadText, 'utf8').digest('hex')}`;
}

// mock de service_role com dispatch por tabela
function mockServiceRole(opts: { existingWebhook?: unknown; integration?: unknown }) {
  const from = jest.fn((table: string) => {
    if (table === 'webhook_events') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: opts.existingWebhook ?? null, error: null }),
          })),
        })),
      };
    }
    if (table === 'meta_integrations') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: opts.integration ?? null, error: null }),
          })),
        })),
      };
    }
    return {};
  });
  (createServiceRoleClient as jest.Mock).mockImplementation(() => ({ from }));
}

// fake tx usado dentro do withTenantContext; o claim usa $queryRaw
let fakeTx: { $queryRaw: jest.Mock };

function mockTenant(cb?: (tx: unknown) => Promise<unknown>) {
  (withTenantContext as jest.Mock).mockImplementation(async (_org: string, fn: (tx: unknown) => Promise<unknown>) => {
    if (cb) return cb(fakeTx);
    return fn(fakeTx);
  });
}

function buildPost(payload: unknown, { signature }: { signature?: string }) {
  const text = JSON.stringify(payload);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signature !== undefined) headers['X-Hub-Signature-256'] = signature;
  const { NextRequest } = require('next/server');
  return new NextRequest('http://localhost/api/webhooks/meta', {
    method: 'POST',
    headers,
    body: text,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  fakeTx = { $queryRaw: jest.fn() };
  mockTenant();
});

// ============================================================================
// GET — verificação do hub
// ============================================================================
describe('GET /api/webhooks/meta', () => {
  it('confirma hub.subscribe com verify token correto', async () => {
    const { NextRequest } = require('next/server');
    const req = new NextRequest(
      'http://localhost/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=' + VERIFY_TOKEN + '&hub.challenge=ch-123',
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ch-123');
  });

  it('rejeita hub com verify token errado', async () => {
    const { NextRequest } = require('next/server');
    const req = new NextRequest(
      'http://localhost/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=ch',
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// POST — assinatura
// ============================================================================
describe('POST /api/webhooks/meta — assinatura', () => {
  it('401 signature_missing quando o header não existe', async () => {
    const res = await POST(buildPost(whatsappPayload('wamid.1'), {}));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('signature_missing');
  });

  it('401 signature_invalid quando o HMAC não confere', async () => {
    const res = await POST(
      buildPost(whatsappPayload('wamid.1'), { signature: 'sha256=deadbeef' }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('signature_invalid');
  });
});

// ============================================================================
// POST — idempotência (fast-path + claim atômico)
// ============================================================================
describe('POST /api/webhooks/meta — idempotência', () => {
  it('fast-path: evento já processado → 200 already_processed, sem entrar na transação', async () => {
    mockServiceRole({ existingWebhook: { event_id: 'eid-existing' }, integration: { organization_id: 'org-9' } });
    const text = JSON.stringify(whatsappPayload('wamid.dupe'));
    const res = await POST(buildPost(whatsappPayload('wamid.dupe'), { signature: sign(text) }));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('already_processed');
    expect(withTenantContext).not.toHaveBeenCalled();
  });

  it('novo evento: claim retorna event_id → processa e 200 accepted; SQL usa ON CONFLICT + RETURNING', async () => {
    mockServiceRole({ existingWebhook: null, integration: { organization_id: 'org-9' } });
    (fakeTx.$queryRaw as jest.Mock).mockResolvedValue([{ event_id: 'new-eid' }]);
    (processWhatsAppPayload as jest.Mock).mockResolvedValue([
      { success: true, contactId: 'c1', messageId: 'm1' },
    ]);

    const payload = whatsappPayload('wamid.novo');
    const text = JSON.stringify(payload);
    const res = await POST(buildPost(payload, { signature: sign(text) }));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('accepted');
    expect(processWhatsAppPayload).toHaveBeenCalled();

    // o claim é um INSERT ... ON CONFLICT (meta_event_id) DO NOTHING RETURNING event_id
    const sql = (fakeTx.$queryRaw.mock.calls[0][0] as string[]).join('');
    expect(sql).toContain('ON CONFLICT (meta_event_id)');
    expect(sql).toContain('RETURNING event_id');
  });

  it('claim retorna vazio (concorrência) → 200 duplicate_skipped, sem processar', async () => {
    mockServiceRole({ existingWebhook: null, integration: { organization_id: 'org-9' } });
    (fakeTx.$queryRaw as jest.Mock).mockResolvedValue([]);

    const payload = whatsappPayload('wamid.concurrente');
    const text = JSON.stringify(payload);
    const res = await POST(buildPost(payload, { signature: sign(text) }));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('duplicate_skipped');
    expect(processWhatsAppPayload).not.toHaveBeenCalled();
  });

  it('claim lança (015 ausente / infra) → segue processando, 200 accepted', async () => {
    mockServiceRole({ existingWebhook: null, integration: { organization_id: 'org-9' } });
    (fakeTx.$queryRaw as jest.Mock).mockRejectedValue(new Error('42703 no unique constraint'));
    (processWhatsAppPayload as jest.Mock).mockResolvedValue([
      { success: true, contactId: 'c1', messageId: 'm1' },
    ]);

    const payload = whatsappPayload('wamid.claim-erro');
    const text = JSON.stringify(payload);
    const res = await POST(buildPost(payload, { signature: sign(text) }));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('accepted');
    expect(processWhatsAppPayload).toHaveBeenCalled();
  });
});

// ============================================================================
// POST — resolução de tenant
// ============================================================================
describe('POST /api/webhooks/meta — tenant', () => {
  it('phone_number_id ausente → 200 accepted, sem transação', async () => {
    mockServiceRole({});
    const payload = { entry: [{ id: 'e', changes: [{ value: { messages: [{ id: 'wamid.x' }] } }] }] };
    const text = JSON.stringify(payload);
    const res = await POST(buildPost(payload, { signature: sign(text) }));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('accepted');
    expect(withTenantContext).not.toHaveBeenCalled();
  });

  it('tenant desconhecido (integração nula) → 200 accepted, sem transação', async () => {
    mockServiceRole({ existingWebhook: null, integration: null });
    const payload = whatsappPayload('wamid.unknown', '999');
    const text = JSON.stringify(payload);
    const res = await POST(buildPost(payload, { signature: sign(text) }));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('accepted');
    expect(withTenantContext).not.toHaveBeenCalled();
  });
});
