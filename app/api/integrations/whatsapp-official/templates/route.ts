// POST /api/integrations/whatsapp-official/templates â€” CRUD de templates
// oficiais (espelho local 019 + Graph via factory).
//
// GET  â†’ lista o espelho local (status PENDING/APPROVED/... reais do Ãºltimo
//        poll; o cron poll-template-status.js mantÃ©m fresco).
// POST â†’ cria no Meta (Graph, `allow_category_change:true` no adapter da casa)
//        e grava como PENDING. NUNCA fica "aprovado" sem o Meta dizer.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../../../src/lib/auth';
import {
  getChannelDecrypted,
  getWhatsAppProvider,
  listTemplateRows,
  upsertTemplateRow,
} from '../../../../../src/integrations/whatsapp';
import type { OfficialTemplateSpec } from '../../../../../src/integrations/whatsapp';
import { createServiceRoleClient } from '../../../../../src/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CATS = new Set(['MARKETING', 'UTILITY', 'AUTHENTICATION']);
const NAME_RE = /^[a-z0-9_]{1,50}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await listTemplateRows(createServiceRoleClient(), user.organizationId);
  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      language: r.language,
      category: r.category,
      status: r.status,
      rejectionReason: r.rejectionReason,
      lastCheckedAt: r.lastCheckedAt,
    })),
  });
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
  delete body.organizationId;
  delete body.userId;

  const name = typeof body.name === 'string' ? body.name.trim().toLowerCase() : '';
  if (!NAME_RE.test(name)) return NextResponse.json({ error: 'invalid_template_name' }, { status: 400 });
  const category = typeof body.category === 'string' ? body.category : '';
  if (!CATS.has(category)) return NextResponse.json({ error: 'invalid_category' }, { status: 400 });
  const language = typeof body.language === 'string' && /^[a-z]{2}_[A-Z]{2}$/.test(body.language) ? body.language : 'pt_BR';
  const bodyText = typeof body.body === 'string' ? body.body.trim() : '';
  if (!bodyText || bodyText.length > 4096) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const client = createServiceRoleClient();
  const channel = await getChannelDecrypted(client, user.organizationId);
  if (!channel || channel.status !== 'CONNECTED' || !channel.wabaId || !channel.accessToken) {
    return NextResponse.json({ error: 'whatsapp_channel_not_connected' }, { status: 409 });
  }

  const spec: OfficialTemplateSpec = { name, category: category as OfficialTemplateSpec['category'], language, body: bodyText };
  const r = await getWhatsAppProvider().createTemplate(
    { accessToken: channel.accessToken, phoneNumberId: channel.phoneNumberId ?? '', wabaId: channel.wabaId },
    spec,
  );
  if (!r.ok) {
    return NextResponse.json({ error: 'template_create_failed', detail: r.errorDetail ?? r.error }, { status: 502 });
  }

  await upsertTemplateRow(client, {
    organizationId: user.organizationId,
    name,
    language,
    category: spec.category,
    status: 'PENDING',
    componentsJson: [{ type: 'BODY', text: bodyText }],
  });
  console.info('[openbsp] template criado (PENDING)', { org: user.organizationId, name });
  return NextResponse.json({ ok: true, name, status: 'PENDING' }, { status: 201 });
}
