// FASE 1 — Database Adapter — Tipos compartilhados

export type TenantContext = {
  /** Tipo de tenant — 'org' para organizações, 'user' para usuários */
  type: 'org' | 'user';
  /** ID do tenant (organizationId ou userId) */
  id: string;
};

/** Opções de consulta para findMany */
export interface QueryOptions {
  /** Campo de ordenação */
  orderBy?: string;
  /** Direção da ordenação (asc | desc) */
  orderDirection?: 'asc' | 'desc';
  /** Número máximo de registros retornados */
  limit?: number;
  /** Deslocamento para paginação */
  offset?: number;
  /** Campos a selecionar (null = todos) */
  select?: string[] | null;
}

/** Cliente de transação — subconjunto do adapter usado dentro de callbacks */
export interface TransactionClient {
  /** Busca múltiplos registros */
  findMany<T>(model: string, where: Record<string, unknown>, options?: QueryOptions): Promise<T[]>;
  /** Busca um único registro */
  findUnique<T>(model: string, where: Record<string, unknown>): Promise<T | null>;
  /** Cria um registro */
  create<T>(model: string, data: Record<string, unknown>): Promise<T>;
  /** Atualiza registros */
  update<T>(model: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<T>;
  /** Deleta registros */
  delete(model: string, where: Record<string, unknown>): Promise<void>;
}

/** Interface unificada de acesso a dados */
export interface DatabaseAdapter {
  /** Busca múltiplos registros de um modelo */
  findMany<T>(model: string, where: Record<string, unknown>, options?: QueryOptions): Promise<T[]>;
  /** Busca um único registro de um modelo. Retorna null se não encontrado. */
  findUnique<T>(model: string, where: Record<string, unknown>): Promise<T | null>;
  /** Cria um novo registro. O tenant context é obrigatório para RLS. */
  create<T>(model: string, data: Record<string, unknown>, tenant?: TenantContext): Promise<T>;
  /** Atualiza registros que correspondem ao where clause. Retorna o primeiro registro atualizado. */
  update<T>(model: string, where: Record<string, unknown>, data: Record<string, unknown>, tenant?: TenantContext): Promise<T>;
  /** Deleta registros que correspondem ao where clause. O tenant context é obrigatório para RLS. */
  delete(model: string, where: Record<string, unknown>, tenant?: TenantContext): Promise<void>;
  /** Executa uma transação com o tenant context aplicado. O callback recebe um TransactionClient com métodos reduzidos. */
  transaction<T>(tenant: TenantContext, callback: (tx: TransactionClient) => Promise<T>): Promise<T>;
}

/** Erro lançado quando o contexto do tenant não foi configurado */
export class DatabaseContextError extends Error {
  constructor(public readonly tenant: TenantContext | null) {
    super(`DatabaseContextError: tenant context is ${tenant ? `missing required field (type=${tenant.type}, id=${tenant.id})` : 'not provided'}`);
    this.name = 'DatabaseContextError';
  }
}