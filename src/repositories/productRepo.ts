// FASE 4 — REPOSITORY STUB (não inventado; baseado no padrão crmRepo)
import { Product } from '../models/product';
export interface ProductRepo { findByOrganization(org: string): Promise<Product[]>; create(data: Partial<Product>): Promise<Product>; }
export const productRepo: ProductRepo = {
  async findByOrganization(org: string) { return []; },
  async create(data) { return { ...data, id: 'p-' + Date.now(), createdAt: new Date().toISOString() } as Product; }
};
