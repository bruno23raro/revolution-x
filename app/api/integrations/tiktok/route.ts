// FASE 2 · slice 5 — Listagem de contas TikTok conectadas (METADADOS).
//
// GET /api/integrations/tiktok → { accounts, count }
//
// Usa `listTikTokAccounts` (AgentMemory) para devolver SOMENTE metadados
// (openId, source, obtainedAt, tokenExpired) — NUNCA tokens/segredos. É a
// fonte do seletor de contas nos formulários de publicação/agendamento.
//
// Degrada honesto: fila/memória indisponível → `accounts: []` (não 500),
// pois `listTikTokAccounts` já captura `TaskQueueUnavailableError`.
//
// NOTE: O try/catch aqui captura TaskQueueUnavailableError para garantir 200
// em vez de 500 quando a tabela de fila não está migrada no ambiente.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listTikTokAccounts } from '@/integrations/tiktok/resolveAccess';
import { isQueueUnavailable } from '@/lib/taskQueue';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = { organizationId: user.organizationId, userId: user.id };
  let accounts;
  try {
    accounts = await listTikTokAccounts(prisma, scope);
  } catch (e) {
    if (isQueueUnavailable(e)) {
      return NextResponse.json({ accounts: [], count: 0 }, { status: 200 });
    }
    throw e;
  }
  return NextResponse.json({ accounts, count: accounts.length });
}