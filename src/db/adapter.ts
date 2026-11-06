// FASE 1 — Database Adapter — Interface principal

import type { QueryOptions, TenantContext, TransactionClient } from './types';

/**
 * Interface unificada de acesso a dados.
 *
 * Abstrai o cliente de banco (Prisma/Supabase/Outro) em uma API CRUD genérica
 * que requer tenant context para todas as operações que gravam dados.
 *
 * @example
 * ```ts
 * const adapter = createDatabaseAdapter();
 * const contacts = await adapter.findMany<Contact>('contact', { organizationId: orgId });
 * ```
 */
export interface DatabaseAdapter {
  /**
   * Busca múltiplos registros de um modelo.
   * RLS é garantido via tenant context.
   */
  findMany<T>(model: string, where: Record<string, unknown>, options?: QueryOptions): Promise<T[]>;

  /**
   * Busca um único registro de um modelo. Retorna null se não encontrado.
   */
  findUnique<T>(model: string, where: Record<string, unknown>): Promise<T | null>;

  /**
   * Cria um novo registro. O tenant context é obrigatório para RLS.
   */
  create<T>(model: string, data: Record<string, unknown>, tenant?: TenantContext): Promise<T>;

  /**
   * Atualiza registros que correspondem ao where clause.
   * Retorna o primeiro registro atualizado.
   */
  update<T>(model: string, where: Record<string, unknown>, data: Record<string, unknown>, tenant?: TenantContext): Promise<T>;

  /**
   * Deleta registros que correspondem ao where clause.
   * O tenant context é obrigatório para RLS.
   */
  delete(model: string, where: Record<string, unknown>, tenant?: TenantContext): Promise<void>;

  /**
   * Executa uma transação com o tenant context aplicado.
   * O callback recebe um TransactionClient com métodos reduzidos.
   */
  transaction<T>(tenant: TenantContext, callback: (tx: TransactionClient) => Promise<T>): Promise<T>;
}