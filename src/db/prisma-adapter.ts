// FASE 1 — Database Adapter — Implementação Prisma

import type { PrismaClient } from '@prisma/client';
import type {
  DatabaseAdapter,
  QueryOptions,
  TenantContext,
  TransactionClient,
} from './types';
import { DatabaseContextError } from './types';

/**
 * Adapter Prisma que implementa a interface DatabaseAdapter.
 *
 * Usa set_config antes de cada transação para garantir o contexto
 * de tenant correto (org ou user), conforme RLS do banco.
 */
export class PrismaDatabaseAdapter implements DatabaseAdapter {
  constructor(
    private readonly client: PrismaClient,
    private readonly defaultTenant: TenantContext,
  ) {}

  private resolveTenant(tenant?: TenantContext): TenantContext {
    if (!tenant) {
      if (!this.defaultTenant?.id) {
        throw new DatabaseContextError(null);
      }
      return this.defaultTenant;
    }
    if (!tenant.id) {
      throw new DatabaseContextError(tenant);
    }
    return tenant;
  }

  /** Aplica o contexto de tenant via set_config na conexão */
  private async applyTenant(tenant: TenantContext): Promise<void> {
    if (tenant.type === 'org') {
      await this.client.$executeRaw`SELECT set_config('app.current_org', ${tenant.id}, true)`;
    } else {
      await this.client.$executeRaw`SELECT set_config('app.current_user_id', ${tenant.id}, true)`;
    }
  }

  async findMany<T>(
    model: string,
    where: Record<string, unknown>,
    options?: QueryOptions,
  ): Promise<T[]> {
    const tenant = this.resolveTenant();
    await this.applyTenant(tenant);
    const prismaModel = this.getModel(model);
    const args: any = { where };
    if (options?.orderBy) {
      args.orderBy = { [options.orderBy]: options.orderDirection ?? 'desc' };
    }
    if (options?.limit !== undefined) args.take = options.limit;
    if (options?.offset !== undefined) args.skip = options.offset;
    if (options?.select) {
      args.select = Object.fromEntries(options.select.map((f) => [f, true]));
    }
    const rows = await prismaModel.findMany(args);
    return rows as T[];
  }

  async findUnique<T>(
    model: string,
    where: Record<string, unknown>,
  ): Promise<T | null> {
    const tenant = this.resolveTenant();
    await this.applyTenant(tenant);
    const prismaModel = this.getModel(model);
    const row = await prismaModel.findFirst({ where });
    return (row ?? null) as T | null;
  }

  async create<T>(
    model: string,
    data: Record<string, unknown>,
    tenant?: TenantContext,
  ): Promise<T> {
    const resolvedTenant = this.resolveTenant(tenant);
    await this.applyTenant(resolvedTenant);
    const prismaModel = this.getModel(model);
    const row = await prismaModel.create({ data });
    return row as T;
  }

  async update<T>(
    model: string,
    where: Record<string, unknown>,
    data: Record<string, unknown>,
    tenant?: TenantContext,
  ): Promise<T> {
    const resolvedTenant = this.resolveTenant(tenant);
    await this.applyTenant(resolvedTenant);
    const prismaModel = this.getModel(model);
    await prismaModel.updateMany({ where, data });
    const updated = await prismaModel.findFirst({ where });
    if (!updated) {
      throw new Error(`No record found matching where clause for ${model}`);
    }
    return updated as T;
  }

  async delete(
    model: string,
    where: Record<string, unknown>,
    tenant?: TenantContext,
  ): Promise<void> {
    const resolvedTenant = this.resolveTenant(tenant);
    await this.applyTenant(resolvedTenant);
    const prismaModel = this.getModel(model);
    await prismaModel.deleteMany({ where });
  }

  async transaction<T>(
    tenant: TenantContext,
    callback: (tx: TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!tenant.id) {
      throw new DatabaseContextError(tenant);
    }
    await this.applyTenant(tenant);
    const proxy: TransactionClient = {
      findMany: <M>(m: string, w: Record<string, unknown>, o?: QueryOptions) =>
        this.findMany<M>(m, w, o),
      findUnique: <M>(m: string, w: Record<string, unknown>) =>
        this.findUnique<M>(m, w),
      create: <M>(m: string, d: Record<string, unknown>) =>
        this.create<M>(m, d, tenant),
      update: <M>(m: string, w: Record<string, unknown>, d: Record<string, unknown>) =>
        this.update<M>(m, w, d, tenant),
      delete: (m: string, w: Record<string, unknown>) =>
        this.delete(m, w, tenant),
    };
    return await callback(proxy);
  }

  /** Mapeia nome do modelo para o campo correspondente no PrismaClient */
  private getModel(model: string): any {
    const modelMap: Record<string, string> = {
      contact: 'contact',
      lead: 'lead',
      deal: 'deal',
      pipeline: 'pipeline',
      campaign: 'campaign',
      campaignRecipient: 'campaignRecipient',
      integrations: 'integration',
      integrationEvents: 'integrationEvent',
    };
    const prismaModelName = modelMap[model] ?? model;
    return (this.client as any)[prismaModelName];
  }
}
