// FASE 17 — Rotas de campanhas e disparos (§1/§10).
//
// GET /api/campaigns            → lista da org (tenant-scoped) + contagens
// POST /api/campaigns           → cria rascunho (validação de payload)
//
// Segura por padrão: `organizationId` e `userId` NUNCA vêm do body
// (mass-assignment guard, mesmo padrão do /api/crm/contacts). Nenhum envio
// acontece na criação — a campanha nasce `draft` (§10).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../src/lib/auth';
import { campaignRepoReal } from '../../../src/repositories/campaignRepoReal';

// 'whatsapp_api' = canal OFICIAL (OpenBSP/Cloud API, migration 019);
// 'whatsapp' permanece o canal legado (QR/MetaIntegration). Nunca mesmo
// numero nos dois.
const CHANNELS = new Set(['whatsapp', 'whatsapp_api', 'email', 'manual']);
const RESULT_KINDS = new Set(['auto', 'manual']);
const MAX_TITLE = 300;
const MAX_MESSAGE = 4096;
const MAX_VARS = 64;
const MAX_VAR_VALUE = 4000;
const MAX_TAG = 60;
const MAX_TAGS = 10;
const MAX_SOURCE = 120;
const MAX_ACCOUNT_ID = 64;
const BATCH_MIN = { maxPerRun: 1, delayMs: 250, maxAttempts: 1, backoffFactor: 1 };
const BATCH_MAX = { maxPerRun: 1000, delayMs: 30000, maxAttempts: 5, backoffFactor: 5 };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const items = await campaignRepoReal.list(user.organizationId);
  // Contagens REAIS por campanha (métricas nunca fictícias, §10).
  type Row = (typeof items)[number];
  type Counts = Awaited<ReturnType<typeof campaignRepoReal.recipientCounts>>;
  const withCounts: Array<Row & { counts: Counts }> = [];
  for (const c of items) {
    const counts = await campaignRepoReal.recipientCounts(user.organizationId, c.id);
    withCounts.push({ ...c, counts });
  }
  return NextResponse.json({ organizationId: user.organizationId, items: withCounts });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!isRecord(body)) body = {};
  // Mass-assignment guard: tenant SEMPRE server-derived.
  delete body.organizationId;
  delete body.userId;

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > MAX_TITLE) {
    return NextResponse.json({ error: 'invalid_title' }, { status: 400 });
  }

  const channel = typeof body.channel === 'string' ? body.channel : '';
  if (!CHANNELS.has(channel)) {
    return NextResponse.json({ error: 'invalid_channel' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message : '';
  if (!message || message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: 'invalid_message' }, { status: 400 });
  }

  let resultKind: string | null = null;
  if (body.resultKind !== undefined) {
    if (typeof body.resultKind !== 'string' || !RESULT_KINDS.has(body.resultKind)) {
      return NextResponse.json({ error: 'invalid_result_kind' }, { status: 400 });
    }
    resultKind = body.resultKind;
  }
  if (channel === 'manual' && resultKind !== 'manual') resultKind = 'manual';

  let scheduledFor: string | null = null;
  if (body.scheduledFor !== undefined && body.scheduledFor !== null) {
    if (typeof body.scheduledFor !== 'string' || Number.isNaN(Date.parse(body.scheduledFor))) {
      return NextResponse.json({ error: 'invalid_scheduled_for' }, { status: 400 });
    }
    scheduledFor = body.scheduledFor;
  }

  // Variáveis auxiliares: objeto de chaves/valores de texto (≤64, ≤4000 c).
  let variables: unknown = {};
  if (body.variables !== undefined) {
    if (!isRecord(body.variables)) {
      return NextResponse.json({ error: 'invalid_variables' }, { status: 400 });
    }
    const keys = Object.keys(body.variables);
    if (keys.length > MAX_VARS) {
      return NextResponse.json({ error: 'too_many_variables' }, { status: 400 });
    }
    for (const [k, v] of Object.entries(body.variables)) {
      if (typeof v !== 'string' && typeof v !== 'number') {
        return NextResponse.json({ error: 'invalid_variable_value' }, { status: 400 });
      }
      if (String(v).length > MAX_VAR_VALUE) {
        return NextResponse.json({ error: 'variable_too_long' }, { status: 400 });
      }
      if (k.length > 64) return NextResponse.json({ error: 'variable_key_too_long' }, { status: 400 });
    }
    variables = body.variables;
  }

  // Audiência: tags (≤10×60) + origem (≤120).
  let audience: Record<string, unknown> = {};
  if (body.audience !== undefined) {
    if (!isRecord(body.audience)) {
      return NextResponse.json({ error: 'invalid_audience' }, { status: 400 });
    }
    const tags = Array.isArray(body.audience.tags) ? (body.audience.tags as unknown[]) : undefined;
    if (tags !== undefined) {
      if (tags.length > MAX_TAGS || tags.some((t) => typeof t !== 'string' || (t as string).length > MAX_TAG)) {
        return NextResponse.json({ error: 'invalid_audience_tags' }, { status: 400 });
      }
    }
    const source = body.audience.source;
    if (source !== undefined && source !== null) {
      if (typeof source !== 'string' || source.length > MAX_SOURCE) {
        return NextResponse.json({ error: 'invalid_audience_source' }, { status: 400 });
      }
    }
    audience = { tags: tags ?? [], source: source ?? null };
  }

  // Lote: limites por execução / retry / antiflood (validados).
  let batch: Record<string, unknown> = {};
  if (body.batch !== undefined) {
    if (!isRecord(body.batch)) {
      return NextResponse.json({ error: 'invalid_batch' }, { status: 400 });
    }
    const b = { ...body.batch };
    const range = (key: keyof typeof BATCH_MIN, num: unknown) => {
      if (num === undefined) return true;
      if (typeof num !== 'number' || !Number.isFinite(num)) return false;
      return num >= BATCH_MIN[key] && num <= BATCH_MAX[key];
    };
    for (const key of Object.keys(BATCH_MAX) as Array<keyof typeof BATCH_MAX>) {
      if (b[key] !== undefined && !range(key, b[key])) {
        return NextResponse.json({ error: `invalid_batch_${key}` }, { status: 400 });
      }
    }
    // Só campos reconhecidos vão ao banco (defesa em profundidade).
    const clean: Record<string, unknown> = {};
    for (const key of Object.keys(BATCH_MAX) as Array<keyof typeof BATCH_MAX>) {
      if (b[key] !== undefined) clean[key] = b[key];
    }
    batch = clean;
  }

  let accountId: string | null = null;
  if (body.accountId !== undefined && body.accountId !== null) {
    if (typeof body.accountId !== 'string' || body.accountId.length > MAX_ACCOUNT_ID) {
      return NextResponse.json({ error: 'invalid_account_id' }, { status: 400 });
    }
    accountId = body.accountId;
  }

  const campaign = await campaignRepoReal.create(user.organizationId, {
    userId: user.id,
    title,
    channel,
    resultKind,
    accountId,
    message,
    variables,
    audience,
    batch,
    scheduledFor,
  });

  // Log SEM PII (§8/§10): contagens/ids administrativos apenas.
  console.info('[campaigns] criada', { org: user.organizationId, id: (campaign as { id?: string }).id, channel });

  return NextResponse.json({ campaign }, { status: 201 });
}
