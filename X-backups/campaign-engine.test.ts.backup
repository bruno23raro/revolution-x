// FASE 17 — Testes do motor de campanhas (§9/§10/§11/§16).
//
// Puro: `campaignService` é sem I/O; o `campaignExecutor` recebe repo e
// sender INJETADOS (fake). Nenhum envio real, nenhuma Meta, nenhum banco
// (§16: mocks). Fallback + retry exercitados com sleep injetável.

import {
  canTransition,
  escapeForMessage,
  isMarketingEligible,
  interpolateVars,
  runCampaignBatch,
  selectAudience,
} from '@/services/campaignService';

// Repo fake (o executor importa o real por padrão; mockamos o módulo).
jest.mock('@/repositories/campaignRepoReal', () => ({
  campaignRepoReal: {
    create: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
    recipientCounts: jest.fn(),
    replacePendingRecipients: jest.fn(),
    pendingRecipients: jest.fn(),
    markRecipients: jest.fn(),
    markPendingSkipped: jest.fn(),
    setStatus: jest.fn(),
    pendingCount: jest.fn(),
  },
}));
const { campaignRepoReal: repo } = require('@/repositories/campaignRepoReal');

const { executeCampaignBatch, mergeCounts } = require('@/services/campaignExecutor');

// ── Escape (§9): conteúdo de CSV/variável NUNCA executa ──────────────────────

describe('escapeForMessage', () => {
  it('escapa HTML/JS de variáveis', () => {
    expect(escapeForMessage('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(escapeForMessage('"a" & \'b\' `c`')).toBe('&quot;a&quot; &amp; &#39;b&#39; &#96;c&#96;');
  });

  it('remove caracteres de controle e limita tamanho', () => {
    expect(escapeForMessage('a\u0000b\u001fc')).toBe('abc');
    expect(escapeForMessage('x'.repeat(5000), 100).length).toBe(100);
    expect(escapeForMessage(null)).toBe('');
  });
});

describe('interpolateVars', () => {
  it('substitui chaves, lista usadas e faltantes', () => {
    const { text, missing, used } = interpolateVars(
      'Olá {{nome}}, de {{empresa}}. Cupom: {{cupom}}',
      { nome: 'Maria', empresa: 'ACME' },
    );
    expect(text).toBe('Olá Maria, de ACME. Cupom: ');
    expect(missing).toEqual(['cupom']);
    expect(used).toEqual(['nome', 'empresa']);
  });

  it('valor injetado é SEMPRE escapado (§9)', () => {
    const { text } = interpolateVars('Oi {{nome}}', { nome: '<b>x</b>' });
    expect(text).toBe('Oi &lt;b&gt;x&lt;/b&gt;');
  });
});

// ── Elegibilidade (§11): fail-closed ──────────────────────────────────────────

describe('isMarketingEligible', () => {
  const ok = {
    id: '1',
    consentMarketing: true,
    optOut: false,
    phone: '+5511999990000',
    email: 'a@b.c',
  };
  it('elegível quando consentiu, sem opt-out, com contato do canal', () => {
    expect(isMarketingEligible(ok, { channel: 'whatsapp' }).eligible).toBe(true);
    expect(isMarketingEligible(ok, { channel: 'email' }).eligible).toBe(true);
  });
  it('opt-out tem prioridade', () => {
    const e = isMarketingEligible({ ...ok, optOut: true }, { channel: 'whatsapp' });
    expect(e).toEqual({ eligible: false, reason: 'opt_out' });
  });
  it('sem consentimento comprovado → no_consent', () => {
    expect(
      isMarketingEligible({ ...ok, consentMarketing: false }, { channel: 'whatsapp' }),
    ).toEqual({ eligible: false, reason: 'no_consent' });
  });
  it('canal whatsapp sem telefone → no_phone; email sem e-mail → no_email', () => {
    expect(isMarketingEligible({ ...ok, phone: null }, { channel: 'whatsapp' })).toEqual({
      eligible: false,
      reason: 'no_phone',
    });
    expect(isMarketingEligible({ ...ok, email: null }, { channel: 'email' })).toEqual({
      eligible: false,
      reason: 'no_email',
    });
  });
});

// ── Seleção de audiência (tags/origem + dedupe por canal) ────────────────────

describe('selectAudience', () => {
  const contacts = [
    { id: '1', phone: '+551', email: 'e1@x.com', consentMarketing: true, optOut: false, source: 'loja', tags: '["vip"]' },
    { id: '2', phone: '+552', email: 'e2@x.com', consentMarketing: true, optOut: false, source: 'loja', tags: '["novo"]' },
    { id: '3', phone: '+551', email: 'e3@x.com', consentMarketing: true, optOut: false, source: 'loja', tags: '["vip"]' }, // dup do 1 por phone
    { id: '4', phone: '+554', email: 'e4@x.com', consentMarketing: true, optOut: true, source: 'loja', tags: '["vip"]' }, // opt-out
    { id: '5', phone: '+555', email: 'e5@x.com', consentMarketing: false, source: 'email', tags: '["vip"]' }, // sem consent
  ];

  it('filtra por tag e deduplica pelo identificador do canal', () => {
    const { eligible, skipped, reasons } = selectAudience(contacts, { tags: ['vip'] }, 'whatsapp');
    // 1 ✓; 3 é dup de 1 (mesmo phone) → dedup; 4 opta-out e 5 sem consent → fora.
    expect(eligible.map((c) => c.id)).toEqual(['1']);
    expect(skipped).toBe(2); // 4 (opt_out) + 5 (no_consent); 2 foi só filtrada por tag
    expect(reasons).toEqual({ opt_out: 1, no_consent: 1 });
  });

  it('filtra por origem (case-insensitive)', () => {
    const { eligible } = selectAudience(contacts, { source: 'Loja' }, 'whatsapp');
    expect(eligible.map((c) => c.id)).toEqual(['1', '2']);
  });
});

// ── Lote com retry/backoff (§10) ─────────────────────────────────────────────

describe('runCampaignBatch', () => {
  it('retry com backoff exponencial; resultado por destinatário', async () => {
    const recipients = [
      { id: 'a', to: '+551' },
      { id: 'b', to: '+552' },
      { id: 'c', to: '+553' },
      { id: 'd', to: '+554' },
    ];
    let aCalls = 0;
    const sender = async (id: string) => {
      if (id === 'a') {
        aCalls++;
        return aCalls >= 3 ? { ok: true, externalMessageId: 'w-a' } : { ok: false, error: 'http_error' };
      }
      return { ok: true, externalMessageId: `w-${id}` };
    };
    const sleeps: number[] = [];
    const res = await runCampaignBatch(recipients, sender, {
      maxPerRun: 3,
      delayMs: 100,
      maxAttempts: 3,
      backoffFactor: 2,
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
    });
    // a: falha, falha, ok → sleeps de backoff 100, 200; entre destinatários 100, 100.
    expect(sleeps).toEqual([100, 200, 100, 100]);
    expect(res).toMatchObject({ total: 4, sent: 3, failed: 0, remaining: 1 });
    expect(res.perRecipient.find((p) => p.id === 'a')).toEqual({
      id: 'a',
      ok: true,
      externalMessageId: 'w-a',
      error: undefined,
      attempts: 3,
    });
    expect(res.perRecipient.find((p) => p.id === 'd')).toBeUndefined(); // fora do lote
  });

  it('sender que LANÇA é capturado (nunca derruba o lote)', async () => {
    const res = await runCampaignBatch(
      [{ id: 'x', to: '+559' }],
      async () => {
        throw new Error('boom');
      },
      { maxAttempts: 2, delayMs: 0, sleep: async () => {} },
    );
    expect(res.sent).toBe(0);
    expect(res.failed).toBe(1);
    expect(res.perRecipient[0].error).toBe('boom');
  });

  it('auditoria onAttempt recebe cada tentativa', async () => {
    const attempts: Array<{ id: string; attempt: number }> = [];
    await runCampaignBatch(
      [{ id: 'x', to: '+559' }],
      async () => ({ ok: false, error: 'http_error' }),
      {
        maxAttempts: 2,
        delayMs: 0,
        sleep: async () => {},
        onAttempt: (r) => {
          attempts.push({ id: r.id, attempt: r.attempt });
        },
      },
    );
    expect(attempts).toEqual([
      { id: 'x', attempt: 1 },
      { id: 'x', attempt: 2 },
    ]);
  });
});

// ── Máquina de estados (§10) ──────────────────────────────────────────────────

describe('canTransition', () => {
  it('transições permitidas', () => {
    expect(canTransition('draft', 'queued')).toBe(true);
    expect(canTransition('failed', 'queued')).toBe(true);
    expect(canTransition('running', 'completed_partial')).toBe(true);
    // confirmação manual (§12): usuário reporta ação fora da plataforma.
    expect(canTransition('awaiting_validation', 'completed')).toBe(true);
  });
  it('transições proibidas', () => {
    expect(canTransition('draft', 'completed')).toBe(false);
    expect(canTransition('completed', 'running')).toBe(false);
    expect(canTransition('canceled', 'queued')).toBe(false);
    expect(canTransition('running', 'running')).toBe(false);
  });
});

// ── Executor: repo fake + sender fake (§16) ──────────────────────────────────

function fakeCampaign(over: Record<string, unknown> = {}) {
  return {
    id: 'camp-1',
    organizationId: 'org-1',
    channel: 'whatsapp',
    status: 'running',
    message: 'Oi {{nome}}',
    accountId: 'acc-1',
    resultKind: 'auto',
    variables: {},
    audienceJson: {},
    batchJson: { maxPerRun: 10, delayMs: 10, maxAttempts: 1 },
    totalCount: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    ...over,
  };
}

function pendingRows() {
  return [
    {
      contactId: 'c1',
      contact: {
        id: 'c1',
        name: '<b>Maria</b>',
        phone: '+551191111',
        email: 'm@x.com',
        firstName: null,
        lastName: null,
        company: null,
        source: 'csv',
        tags: null,
        customFields: null,
      },
    },
    {
      contactId: 'c2',
      contact: {
        id: 'c2',
        name: 'João',
        phone: '+552192222',
        email: 'j@x.com',
        firstName: null,
        lastName: null,
        company: null,
        source: 'csv',
        tags: null,
        customFields: null,
      },
    },
  ];
}

describe('executeCampaignBatch (repo + sender injetados)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.pendingRecipients.mockResolvedValue(pendingRows());
    repo.pendingCount.mockResolvedValue(0);
    repo.markRecipients.mockResolvedValue(undefined);
  });

  it('interpola + ESCAPA por contato e persiste resultado real (§9/§10)', async () => {
    const calls: Array<[string, string, string]> = [];
    const sender = async (id: string, to: string, text: string) => {
      calls.push([id, to, text]);
      return { ok: true, externalMessageId: `w-${id}` };
    };
    const res = await executeCampaignBatch({
      campaign: fakeCampaign(),
      sender,
      repo,
      sleep: async () => {},
    });
    expect(res).toEqual({ sent: 2, failed: 0, remaining: 0, nextStatus: 'completed' });
    // Valor de contato com HTML é escapado antes do envio.
    expect(calls[0]).toEqual(['c1', '+551191111', 'Oi &lt;b&gt;Maria&lt;/b&gt;']);
    expect(calls[1]).toEqual(['c2', '+552192222', 'Oi João']);
    // Persistência: status real por destinatário, attempts, externalMessageId.
    expect(repo.markRecipients).toHaveBeenCalledWith('org-1', 'camp-1', [
      { contactId: 'c1', status: 'sent', attempts: 1, externalMessageId: 'w-c1', lastError: null },
      { contactId: 'c2', status: 'sent', attempts: 1, externalMessageId: 'w-c2', lastError: null },
    ]);
  });

  it('falha em um destinatário → completed_partial + lastError', async () => {
    const sender = async (id: string) =>
      id === 'c1' ? { ok: false, error: 'http_error' } : { ok: true, externalMessageId: `w-${id}` };
    const res = await executeCampaignBatch({
      campaign: fakeCampaign(),
      sender,
      repo,
      sleep: async () => {},
    });
    expect(res).toEqual({ sent: 1, failed: 1, remaining: 0, nextStatus: 'completed_partial' });
    const updates = repo.markRecipients.mock.calls[0][2];
    expect(updates[0]).toMatchObject({ contactId: 'c1', status: 'failed', lastError: 'http_error' });
  });

  it('fila restante → running (lote seguinte vem depois) (§10)', async () => {
    repo.pendingCount.mockResolvedValue(50);
    const res = await executeCampaignBatch({
      campaign: fakeCampaign(),
      sender: async () => ({ ok: true, externalMessageId: 'w' }),
      repo,
      sleep: async () => {},
    });
    expect(res.nextStatus).toBe('running');
    expect(res.remaining).toBe(50);
  });

  it('fila vazia: no-op honesto, NÃO fabrica estado terminal (§10/§18)', async () => {
    repo.pendingRecipients.mockResolvedValue([]);
    const res = await executeCampaignBatch({
      campaign: fakeCampaign({ status: 'running', totalCount: 0 }),
      sender: async () => ({ ok: true }),
      repo,
      sleep: async () => {},
    });
    expect(res.nextStatus).toBe('running'); // mantém; não vira completed do nada
    expect(res.sent).toBe(0);
  });
});

describe('mergeCounts', () => {
  it('soma incrementais sem perder histórico', () => {
    expect(
      mergeCounts(
        { sentCount: 5, failedCount: 1, totalCount: 10 } as never,
        { sent: 2, failed: 1 },
      ),
    ).toEqual({ sentCount: 7, failedCount: 2, totalCount: 10 });
  });
});
