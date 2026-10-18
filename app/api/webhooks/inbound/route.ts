// FASE 1 — Webhook de entrada genérico (n8n / Zapier / Make).
//
// POST /api/webhooks/inbound
//   headers: X-Organization-Id (uuid do tenant) + X-Webhook-Secret (secret guardado)
//   body:    payload livre da automação
// → { ok, recorded, eventId?, eventType? }
//
// Autenticação POR SECRET COMPARTILHADO (não por sessão do usuário, pois o
// chamador externo não tem login). O secret é guardado em AgentMemory via o
// hub de integrações (provider `webhook_inbound`); a validação é fail-closed:
// sem secret guardado → 401. O lookup é privilegiado (BYPASSRLS) como no
// webhook Meta. A gravação em `webhook_events` é melhor esforço: o ack (200)
// acontece mesmo se a fila/tabela não gravar — o chamador externa não deve
// receber erro do nosso banco.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { providerConfigKey } from '@/integrations/configStore';

export const dynamic = 'force-dynamic';

const KIND = 'preference';
const WEBHOOK_KEY = providerConfigKey('webhook_inbound'); // 'integration:webhook_inbound'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Comparação em tempo constante (evita ataque por timing no secret). */
function constantTimeEq(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const orgId = (req.headers.get('x-organization-id') ?? '').trim();
  const secret = req.headers.get('x-webhook-secret') ?? '';

  if (!UUID_RE.test(orgId)) return NextResponse.json({ error: 'org_invalid' }, { status: 400 });
  if (!secret) return NextResponse.json({ error: 'missing_secret' }, { status: 401 });

  let raw = '';
  try {
    raw = await req.text();
  } catch {
    raw = '';
  }
  let body: Record<string, any> = {};
  try {
    body = raw ? (JSON.parse(raw) as Record<string, any>) : {};
  } catch {
    body = {}; // payload não-JSON: segue com vazio, o secret ainda é validado
  }

  // Secret guardado (BYPASSRLS). Falha fechada: nada guardado → 401.
  let stored: string | undefined;
  try {
    const row = await prisma.agentMemory.findFirst({
      where: { organizationId: orgId, kind: KIND, memoryKey: WEBHOOK_KEY, supersededAt: null },
      orderBy: { updatedAt: 'desc' },
      select: { valueJson: true },
    });
    stored = (row?.valueJson as { secret?: string } | null)?.secret;
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
  if (!stored || !constantTimeEq(stored, secret)) {
    return NextResponse.json({ error: 'invalid_secret' }, { status: 401 });
  }

  const payloadHash = crypto.createHash('sha256').update(raw || JSON.stringify(body)).digest('hex');
  const eventType = String(body.event ?? body.type ?? 'generic').slice(0, 50);

  let recorded = false;
  let eventId: string | undefined;
  try {
    const ev = await prisma.webhookEvent.create({
      data: { organizationId: orgId, eventType, payloadHash, processedAt: new Date() },
    });
    eventId = ev.id;
    recorded = true;
  } catch {
    recorded = false; // degrade: ack (200) mesmo sem gravar
  }

  return NextResponse.json({ ok: true, recorded, eventId, eventType }, { status: 200 });
}
