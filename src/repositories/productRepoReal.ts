// FASE 4 — REPOSITORY REAL — products (Migration 004 executada e confirmada)
import { Product } from '../models/product';
import { withTenantContext } from '../lib/prisma';

export interface ProductRepo {
  findByOrganization(orgId: string): Promise<Product[]>;
  create(data: Partial<Product> & { organizationId: string }): Promise<Product>;
}

export const productRepoReal: ProductRepo = {
  async findByOrganization(orgId: string): Promise<Product[]> {
    return await withTenantContext(orgId, async (tx) => {
      const rows = await tx.product.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((r) => ({
        id: r.id,
        organizationId: r.organizationId,
        name: r.name,
        description: r.description ?? undefined,
        price: r.price !== null ? Number(r.price) : undefined,
        category: r.category ?? undefined,
        active: true,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.createdAt.toISOString(),
      }));
    });
  },

  async create(data: Partial<Product> & { organizationId: string }): Promise<Product> {
    return await withTenantContext(data.organizationId, async (tx) => {
      const row = await tx.product.create({
        data: {
          organizationId: data.organizationId,
          // Generate a deterministic SKU if not provided
          sku: `sku-${Date.now()}`,
          name: data.name!,
          description: data.description ?? null,
          price: data.price ?? 0,
          category: data.category ?? null,
        },
      });
      return {
        id: row.id,
        organizationId: row.organizationId,
        name: row.name,
        description: row.description ?? undefined,
        price: row.price !== null ? Number(row.price) : undefined,
        category: row.category ?? undefined,
        active: true,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.createdAt.toISOString(),
      };
    });
  },
};
