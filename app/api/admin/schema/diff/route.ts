// FASE 8 — Endpoint de diff de schema administrativo
// GET /api/admin/schema/diff — Comparar schema local vs produção

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '../../../../../src/lib/auth';
import { prisma } from '../../../../../src/lib/prisma';

// C3 — schema/diff: cache 60s + timeout 10s
// Duas chamadas seguidas não reconsultam o banco (cache na borda)
const SCHEMA_DIFF_CACHE_TTL = 60 * 1000; // 60 seconds
const SCHEMA_DIFF_TIMEOUT = 10 * 1000; // 10 seconds

// Simple in-memory cache for this request lifecycle
let lastDiffResult: {
  data: any;
  timestamp: number;
} | null = null;

function hasCacheExpired(): boolean {
  if (!lastDiffResult) return true;
  return Date.now() - lastDiffResult.timestamp > SCHEMA_DIFF_CACHE_TTL;
}

async function requireAdmin(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'owner') return user;
  const memberships = await getAllOrganizationMemberships(req);
  const ok = memberships?.some((m) => m.role === 'admin' || m.role === 'owner');
  return ok ? user : null;
}

// Tabela em snake_case no banco (legado) não é comparada pelo modelo Prisma
const LEGACY_SNAKE_TABLES = new Set([
  'meta_integrations', 'webhook_events', 'admin_alerts',
]);

// ------------------------------------------------------------------
// GET — Gerar diff de schema (esperado via Prisma DMMF vs real via information_schema)
// ------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized (papel admin/owner exigido)' },
      { status: 401 },
    );
  }

  // C3 — Retornar cache se válido (60s TTL)
  if (!hasCacheExpired()) {
    return NextResponse.json({ diff: lastDiffResult!.data }, { status: 200 });
  }

  try {
    // Timeout 10s (C3) na consulta de schema real
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('schema query timeout')), SCHEMA_DIFF_TIMEOUT),
    );
    const rows = (await Promise.race([
      prisma.$queryRaw`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
      `,
      timeout,
    ])) as Array<{ table_name: string; column_name: string }>;

    // Real: mapa tabela → colunas
    const actual = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!actual.has(r.table_name)) actual.set(r.table_name, new Set());
      actual.get(r.table_name)!.add(r.column_name);
    }

    // Esperado: modelos do schema Prisma (campos escalares)
    const models: any[] = ((Prisma as any).dmmf?.datamodel?.models ?? []) as any[];
    const missingTables: string[] = [];
    const extraTables: string[] = [];
    const missingColumns: Array<{ table: string; column: string }> = [];
    const extraColumns: Array<{ table: string; column: string }> = [];

    for (const model of models) {
      const table = model.dbName ?? model.name;
      if (LEGACY_SNAKE_TABLES.has(table)) continue;
      const expectedCols: Set<string> = new Set(
        model.fields.filter((f: any) => f.kind !== 'object').map((f: any) => f.dbName ?? f.name),
      );
      const actualCols = actual.get(table);
      if (!actualCols) {
        missingTables.push(table);
        continue;
      }
      for (const c of expectedCols) {
        if (!actualCols.has(c)) missingColumns.push({ table, column: c });
      }
      for (const c of actualCols) {
        if (!expectedCols.has(c)) extraColumns.push({ table, column: c });
      }
    }
    for (const t of actual.keys()) {
      if (LEGACY_SNAKE_TABLES.has(t)) continue;
      if (!models.some((m: any) => (m.dbName ?? m.name) === t)) extraTables.push(t);
    }

    const hasDrift =
      missingTables.length > 0 || extraTables.length > 0 ||
      missingColumns.length > 0 || extraColumns.length > 0;

    const diff = {
      hasDrift,
      localSchemaVersion: 'desenvolvimento',
      missingTables,
      extraTables,
      missingColumns,
      extraColumns,
      indexMismatches: [],
      constraintMismatches: [],
    };

    // Atualizar cache
    lastDiffResult = { data: diff, timestamp: Date.now() };

    return NextResponse.json({ diff }, { status: 200 });
  } catch (e) {
    console.error('Erro ao gerar diff de schema:', e);
    return NextResponse.json(
      { error: 'Erro interno ao gerar diff' },
      { status: 500 },
    );
  }
}
