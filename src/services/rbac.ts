import { TenantContext, TenantAccessDenied, hasPermission } from './tenant';

export function requirePermission(context: TenantContext | null, permission: string, grants: Record<string, string[]>): TenantContext {
  if (!context || !hasPermission(context, permission, grants)) throw new TenantAccessDenied();
  return context;
}

export const defaultGrants: Record<string, string[]> = {
  owner: ['organization.read', 'organization.update', 'members.read', 'members.create', 'members.update', 'members.remove', 'billing.read', 'billing.manage'],
  admin: ['organization.read', 'organization.update', 'members.read', 'members.create', 'members.update'],
  member: ['organization.read'],
};
