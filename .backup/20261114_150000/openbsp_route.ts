// Webhook handler unificado para OpenBSP — rotas por tabela
//
// Estrutura de rotas:
//   /api/webhooks/openbsp/messages     → webhook para tabela 'messages'
//   /api/webhooks/openbsp/accounts     → webhook para tabela 'accounts'
//   /api/webhooks/openbsp/contacts     → webhook para tabela 'contacts'

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { handleOpenbspEvent } from './shared';

const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024;
const OPENBSP_WEBHOOK_SECRET = process.env.OPENBSP_WEBHOOK_SECRET;
const OPENBSP_WEBHOOK_VERIFY_TOKEN = process.env.OPENBSP_WEBHOOK_VERIFY_TOKEN;

function verifySignature(rawBody: string, signature: string): boolean {
  if (!OPENBSP_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', OPENBSP_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex');
  const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (token && challenge) {
    if (OPENBSP_WEBHOOK_VERIFY_TOKEN && token === OPENBSP_WEBHOOK_VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 });
    }
  }
  return NextResponse.json({ error: 'invalid_verification' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  const signature = req.headers.get('X-Openbsp-Signature-256');
  if (!signature || !OPENBSP_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'signature_missing' }, { status: 401 });
  }

  const rawBody = await req.text();
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'signature_invalid' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  // Extraír table_name da URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  // Formato: /api/webhooks/openbsp/{table}
  const tableName = pathParts[pathParts.length - 1] ?? '';

  await handleOpenbspEvent(tableName, payload, rawBody);
  return NextResponse.json({ status: 'accepted' }, { status: 200 });
}
