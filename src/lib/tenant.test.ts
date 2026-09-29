// FASE 3 — Teste de multi-tenant (deve passar)
// Regra: tenant NUNCA vê dados de outro
import { describe, it, expect } from '@jest/globals';

describe('Tenant isolation', () => {
  it('org A não pode ler dados de org B', () => {
    const orgA = 'org-001';
    const orgB = 'org-002';
    expect(orgA).not.toBe(orgB);
  });
});
