// FASE 4 — REPOSITORY REAL — products (Migration 004 executada e confirmada)
import { Product } from '../models/product';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface ProductRepo {
  findByOrganization(orgId: string): Promise<Product[]>;
  create(data: Partial<Product> & { organizationId: string }): Promise<Product>;
}

export const productRepoReal: ProductRepo = {
  async findByOrganization(orgId: string): Promise<Product[]> {
    const res = await pool.query('SELECT * FROM products WHERE organization_id = $1', [orgId]);
    return res.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      name: r.name,
      description: r.description || null,
      price: r.price !== null ? Number(r.price) : undefined,
      category: r.category || null,
      active: r.active ?? true,
      createdAt: r.created_at ? r.created_at.toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? r.updated_at.toISOString() : new Date().toISOString(),
    }));
  },
  async create(data: Partial<Product> & { organizationId: string }): Promise<Product> {
    const res = await pool.query(
      'INSERT INTO products (organization_id, name, description, price, category, active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [
        data.organizationId,
        data.name,
        data.description || null,
        data.price !== undefined && data.price !== null ? data.price : null,
        data.category || null,
        data.active !== undefined ? data.active : true,
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      organizationId: r.organization_id,
      name: r.name,
      description: r.description || null,
      price: r.price !== null ? Number(r.price) : undefined,
      category: r.category || null,
      active: r.active ?? true,
      createdAt: r.created_at ? r.created_at.toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? r.updated_at.toISOString() : new Date().toISOString(),
    };
  },
};
