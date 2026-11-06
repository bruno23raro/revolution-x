// FASE 1 — Database Adapter — Teste de Interface e Types

import { describe, it, expect } from '@jest/globals';
import { DatabaseContextError } from './types';
import type { DatabaseAdapter, QueryOptions, TenantContext } from './types';

// ===================== TESTES =====================

describe('DatabaseAdapter Interface', () => {
  it('should export DatabaseAdapter interface with all required methods', () => {
    // Verificar que a interface existe e tem os métodos esperados
    // Usamos um objeto literal que satisfaz a interface DatabaseAdapter
    const adapter: DatabaseAdapter = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn(),
    };

    const methods = ['findMany', 'findUnique', 'create', 'update', 'delete', 'transaction'];
    methods.forEach((method) => {
      expect(typeof adapter[method]).toBe('function');
    });
  });

  it('should export QueryOptions type', () => {
    const options: QueryOptions = {
      orderBy: 'name',
      orderDirection: 'desc',
      limit: 10,
      offset: 0,
      select: ['id', 'name'],
    };
    expect(options).toBeDefined();
  });

  it('should export TenantContext type', () => {
    const tenant: TenantContext = { type: 'org', id: 'org-123' };
    expect(tenant.type).toBe('org');
    expect(tenant.id).toBe('org-123');
  });

  it('should export DatabaseContextError class', () => {
    expect(() => {
      throw new DatabaseContextError(null);
    }).toThrow('DatabaseContextError');
  });

  it('should export DatabaseContextError with tenant info', () => {
    const tenant = { type: 'org' as const, id: '' };
    expect(() => {
      throw new DatabaseContextError(tenant);
    }).toThrow('missing required field');
  });
});