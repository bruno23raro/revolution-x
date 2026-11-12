// FASE 1 — Database Adapter — Factory

import { PrismaDatabaseAdapter } from './prisma-adapter';
import type { DatabaseAdapter, TenantContext } from './types';
import { createPrismaClient } from '../lib/prisma';

/**
 * Factory para criar instâncias de DatabaseAdapter com contexto de tenant seguro.
 *
 * @param source - String de conexão ou pool PostgreSQL existente
 * @param defaultTenant - Contexto de tenant obrigatório (org ou user). NÃO pode ser undefined ou vazio.
 * @returns DatabaseAdapter configurado com tenant válido
 * @throws Error se defaultTenant.id for vazio ou inválido
 */
export function createDatabaseAdapter(
  source: string | Pool = process.env.DATABASE_URL ?? '',
  defaultTenant: TenantContext,
): DatabaseAdapter {
  if (!defaultTenant?.id) {
    throw new Error(
      'createDatabaseAdapter: defaultTenant.id é obrigatório para segurança RLS. ' +
      'O tenant contexto deve ser resolvido a partir do usuário autenticado.'
    );
  }
  const client = createPrismaClient(source);
  return new PrismaDatabaseAdapter(client, defaultTenant);
}

// Export Pool type for convenience
export type Pool = import('pg').Pool;
