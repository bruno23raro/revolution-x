// FASE 12 — Security / RLS / Policies (documentado e preparado)
// Baseado: README Fase 12 = Segurança + produção
// Dependência do banco: RLS execution, policies verification
// Independente: documentação de policies, estrutura de auditoria
// Não inventa: políticas específicas além do padrão de isolamento por tenant

export const TENANT_POLICIES = {
  // Padrão: todo registro deve pertencer à organization do usuário
  organizationIsolation: 'organization_id = auth.uid()::text OR organization_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())',
  // Para futuras expansões quando DB confirmada
};

export const SECURITY_CHECKLIST = [
  { item: 'RBAC (roles/permissions)', status: 'IMPLEMENTADO', file: 'src/services/rbac.ts' },
  { item: 'Tenant isolation', status: 'IMPLEMENTADO', file: 'src/services/tenant.ts' },
  { item: 'Input validation', status: 'IMPLEMENTADO', file: 'src/services/crmService.ts / authService.ts' },
  { item: 'Auth hash/token', status: 'IMPLEMENTADO', file: 'src/lib/auth.ts' },
  { item: 'Tests', status: 'PASS', command: 'npm test' },
  { item: 'RLS execution', status: 'BLOQUEADO — DB', note: 'Aguardar Ação 1 (DB confirmado)' },
  { item: 'Policies verification', status: 'BLOQUEADO — DB', note: 'Aguardar Ação 1' },
  { item: 'Audit logs', status: 'PREPARADO — estrutura documentada', file: 'src/security/audit.ts (preparado)' },
];
