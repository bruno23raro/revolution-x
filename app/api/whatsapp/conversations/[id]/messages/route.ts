// POST /api/whatsapp/conversations/[id]/messages
// Texto livre so com janela 24h aberta; fora → 409 janela_fechada.
// Template pode enviar fora da janela via sendTemplateViaOpenBSP.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { rateLimit } from '@/middleware/rate-limit';
import { getChannelDecrypted } from '@/integrations/whatsapp/channelRepo';
import {
  openbspConfig,
  getProviderConversation,
  listProviderMessages,
  type OpenbspMessageRow,
} from '@/integrations/whatsapp/openbsp/client';
import { sendViaOpenBSP, sendTemplateViaOpenBSP } from '@/integrations/openbsp/send';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ORG_BSP = () => String(process.env.OPENBSP_ORG_ID ?? '').trim();
const WINDOW_MS = 24 * 60 * 60 * 1000;

const bodySchema = z
  .object({
    text: z.string().trim().min(1).max(4096).optional(),
    template: z
      .object({
        name: z.string().min(1),
        language: z.string().min(2).default('pt_BR'),
        variables: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .refine((v) => Boolean(v.text) || Boolean(v.template), {
    message: 'Informe text ou template',
  });

function isInbound(msg: OpenbspMessageRow): boolean {
  return Boolean(msg.sender_address && msg.sender_address !== msg.organization_address);
}

function isWindowOpen(messages: OpenbspMessageRow[]): boolean {
  const inbound = messages.filter(isInbound);
  if (inbound.length === 0) return false;
  const latest = inbound.reduce((a, b) =>
    new Date(a.timestamp).getTime() >= new Date(b.timestamp).getTime() ? a : b,
  );
  return Date.now() - new Date(latest.timestamp).getTime() < WINDOW_MS;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const rateResult = await rateLimit(req, 'api', { windowMs: 60000, max: 30 });
  if (rateResult.limited) {
    return NextResponse.json({ ok: false, error: 'Rate limit excedido' }, { status: 429 });
  }

  const params = await Promise.resolve(ctx.params);
  const conversationId = String(params.id ?? '').trim();
  if (!conversationId) {
    return NextResponse.json({ ok: false, error: 'id obrigatorio' }, { status: 400 });
  }

  const orgBsp = ORG_BSP();
  if (!orgBsp) {
    return NextResponse.json({ ok: false, error: 'OPENBSP_ORG_ID ausente' }, { status: 503 });
  }

  const channel = await getChannelDecrypted(user.organizationId);
  if (!channel?.phoneNumberId || !channel.isOpenBSPConnected) {
    return NextResponse.json({ ok: false, error: 'canal_ausente' }, { status: 409 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw = await req.json();
    parsed = bodySchema.parse(raw);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'payload_invalido', detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const cfg = openbspConfig();
  if (!cfg) {
    return NextResponse.json({ ok: false, error: 'openbsp_not_configured' }, { status: 503 });
  }

  const convRes = await getProviderConversation(cfg, orgBsp, conversationId, { signal: req.signal });
  if (!convRes.ok) {
    return NextResponse.json(
      { ok: false, error: convRes.error, detail: convRes.errorDetail },
      { status: 502 },
    );
  }
  const conversation = (convRes.data ?? [])[0];
  if (!conversation) {
    return NextResponse.json({ ok: false, error: 'conversa_nao_encontrada' }, { status: 404 });
  }
  if (conversation.organization_address !== channel.phoneNumberId) {
    return NextResponse.json({ ok: false, error: 'Acesso negado' }, { status: 403 });
  }

  const msgsRes = await listProviderMessages(cfg, orgBsp, channel.phoneNumberId, {
    conversationId,
    limit: 50,
    signal: req.signal,
  });
  if (!msgsRes.ok) {
    return NextResponse.json(
      { ok: false, error: msgsRes.error, detail: msgsRes.errorDetail },
      { status: 502 },
    );
  }

  const windowOpen = isWindowOpen(msgsRes.data ?? []);
  const to = conversation.address;

  if (parsed.text && !parsed.template) {
    if (!windowOpen) {
      return NextResponse.json(
        {
          ok: false,
          error: 'janela_fechada',
          message: 'Janela de 24h fechada. Use um template aprovado.',
        },
        { status: 409 },
      );
    }
    const sent = await sendViaOpenBSP(channel, to, parsed.text);
    if (!sent.ok) {
      return NextResponse.json(
        { ok: false, error: sent.error ?? 'envio_falhou', detail: sent.details },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      messageId: sent.messageId,
      via: 'text',
      windowOpen,
    });
  }

  if (parsed.template) {
    const sent = await sendTemplateViaOpenBSP(
      channel,
      to,
      parsed.template.name,
      parsed.template.language,
      parsed.template.variables,
    );
    if (!sent.ok) {
      return NextResponse.json(
        { ok: false, error: sent.error ?? 'envio_falhou', detail: sent.details },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      messageId: sent.messageId,
      via: 'template',
      windowOpen,
    });
  }

  return NextResponse.json({ ok: false, error: 'payload_invalido' }, { status: 400 });
}
