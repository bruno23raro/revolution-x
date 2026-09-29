export interface TenantContext {
  userId: string;
  organizationId: string;
  role: string;
}

export class TenantAccessDenied extends Error {
  constructor() { super('Organization access denied'); }
}

export function requireTenant(context: TenantContext | null, organizationId: string): TenantContext {
  if (!context || context.organizationId !== organizationId) throw new TenantAccessDenied();
  return context;
}

export function hasPermission(context: TenantContext, permission: string, grants: Record<string, string[]>): boolean {
  return (grants[context.role] ?? []).includes(permission);
}
