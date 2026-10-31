// FASE 8 — Endpoint de alertas administrativas
// POST /api/admin/alerts — Gravar alerta no banco (n8n workflows)
// GET /api/admin/alerts — Listar alertas recentes (opcional)

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '../../../../src/lib/auth';
import { prisma } from '../../../../src/lib/prisma';

// Bearer token verification using timing-safe comparison
// Prevents timing attacks on token comparison
// ADMIN_ALERT_TOKEN in .env.local may include "Bearer " prefix — strip it for comparison
const RAW_ADMIN_ALERT_TOKEN = (process.env.ADMIN_ALERT_TOKEN ?? '').replace(/^Bearer\s+/i, '');
const ADMIN_ALERT_TOKEN_BUF = Buffer.from(RAW_ADMIN_ALERT_TOKEN, 'utf8');

// timingSafeEqual polyfill for test environments
// Use a timing-safe comparison to prevent timing attacks
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

function verifyBearerToken(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice('Bearer '.length);
  const tokenBuf = Buffer.from(token, 'utf8');
  if (tokenBuf.length !== ADMIN_ALERT_TOKEN_BUF.length) return false;
  // timingSafeEqual prevents timing side-channel attacks
  return timingSafeEqual(tokenBuf, ADMIN_ALERT_TOKEN_BUF);
}

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

// ------------------------------------------------------------------
// POST — Gravar alerta (usado por n8n WF-03, WF-04)
// ------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // Bearer token verification — prevents timing attacks
  // Tokens ausentes e tokens errados geram 401 idêntico (sem oráculo)
  if (!verifyBearerToken(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  // requireAdmin é best-effort: n8n chama com Bearer válido e sem sessão
  // Supabase (WF-02/03/04/05); o escopo cai para os headers x-org-id/x-user-id.
  const user = await requireAdmin(req).catch(() => null);
  const scope = user
    ? { organizationId: user.organizationId, userId: user.id }
    : {
        organizationId: req.headers.get('x-org-id') || req.headers.get('x-organization-id'),
        userId: req.headers.get('x-user-id'),
      };

  let body: {
    type?: string;
    severity?: 'warning' | 'critical';
    title?: string;
    message?: string;
    statusCode?: number;
    route?: string;
    metadata?: Record<string, unknown>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // C4 — Payload validation
// severity deve ser um dos valores permitidos
// message deve ter no máximo 1000 caracteres
// source é obrigatório (vem do tipo/route context)
// Se inválido → 422 com mensagens específicas

let validationErrors: string[] = [];

// severity must be one of the allowed values
if (body.severity && body.severity !== 'warning' && body.severity !== 'critical') {
  validationErrors.push('severity deve ser warning ou critical');
}

// message must not exceed 1000 characters
if (body.message && body.message.length > 1000) {
  validationErrors.push('message deve ter no máximo 1000 caracteres');
}

// source is required (derived from type or route)
if (!body.type && !body.route) {
  validationErrors.push('source (type ou route) é obrigatório');
}

if (validationErrors.length > 0) {
  return NextResponse.json(
    { error: 'Payload inválido', details: validationErrors },
    { status: 422 }
  );
}

const severity: 'warning' | 'critical' = body.severity || 'warning';
  const title = body.title || 'Sem título';
  const message = body.message || '';
  const statusCode = body.statusCode;
  const route = body.route;
  const metadata = body.metadata ? JSON.parse(JSON.stringify(body.metadata)) : {};

  try {
    await prisma.adminAlert.create({
      data: {
        organizationId: scope.organizationId,
        userId: scope.userId,
        type: body.type || 'schema_drift', // default para compatibilidade n8n
        severity,
        title,
        message,
        statusCode,
        route,
        metadata,
      },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error('Erro ao gravar alerta admin:', e);
    return NextResponse.json(
      { error: 'Erro interno ao gravar alerta' },
      { status: 500 },
    );
  }
}

// ------------------------------------------------------------------
// GET — Listar alertas recentes (opcional, para dashboard)
// ------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized (papel admin/owner exigido)' },
      { status: 401 },
    );
  }

  try {
    // Paginação por cursor: ?cursor=<id>&limit=<1-100>. nextCursor=null → fim da lista.
    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor') || undefined;
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;

    const alerts = await prisma.adminAlert.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { timestamp: 'desc' },
      take: limit + 1, // +1 sonda: existe próxima página?
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        organization: { select: { name: true, slug: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const hasMore = alerts.length > limit;
    const page = hasMore ? alerts.slice(0, limit) : alerts;
    const nextCursor = hasMore ? page[page.length - 1].id : null;
    return NextResponse.json({ alerts: page, nextCursor }, { status: 200 });
  } catch (e) {
    console.error('Erro ao listar alertas admin:', e);
    return NextResponse.json(
      { error: 'Erro interno ao listar alertas' },
      { status: 500 },
    );
  }
}