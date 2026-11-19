export type Role = "owner" | "admin" | "member" | "viewer";

export type Permission =
  | "user:*"
  | "user:self"
  | "tenant:*"
  | "tenant:read"
  | "tenant:write"
  | "billing:*"
  | "billing:read"
  | "billing:write"
  | "integration:*"
  | "integration:read"
  | "integration:write"
  | "campaign:*"
  | "campaign:read"
  | "campaign:write"
  | "contact:*"
  | "contact:read"
  | "contact:write"
  | "lead:*"
  | "lead:read"
  | "lead:write"
  | "deal:*"
  | "deal:read"
  | "deal:write"
  | "pipeline:*"
  | "pipeline:read"
  | "pipeline:write"
  | "whatsapp:*"
  | "whatsapp:read"
  | "whatsapp:write"
  | "analytics:*"
  | "analytics:read"
  | "admin:*"
  | "admin:read"
  | "admin:write"
  | "webhook:*"
  | "webhook:read"
  | "webhook:write"
  | "ai:*"
  | "ai:read"
  | "ai:write";

type WildcardPermission = "user:*" | "tenant:*" | "billing:*" | "integration:*" | "campaign:*" | "contact:*" | "lead:*" | "deal:*" | "pipeline:*" | "whatsapp:*" | "analytics:*" | "admin:*" | "webhook:*" | "ai:*";

const PERMISSIONS: Record<Role, (Permission | WildcardPermission)[]> = {
  owner: [
    "user:*", "tenant:*", "billing:*", "integration:*", "campaign:*",
    "contact:*", "lead:*", "deal:*", "pipeline:*", "whatsapp:*",
    "analytics:*", "admin:*", "webhook:*", "ai:*"
  ],
  admin: [
    "user:self", "tenant:read", "tenant:write", "billing:read",
    "integration:read", "integration:write", "campaign:read", "campaign:write",
    "contact:read", "contact:write", "lead:read", "lead:write",
    "deal:read", "deal:write", "pipeline:read", "pipeline:write",
    "whatsapp:read", "whatsapp:write", "analytics:read", "admin:read",
    "webhook:read", "ai:read", "ai:write"
  ],
  member: [
    "user:self", "tenant:read", "billing:read",
    "integration:read", "campaign:read", "campaign:write",
    "contact:read", "contact:write", "lead:read", "lead:write",
    "deal:read", "deal:write", "pipeline:read",
    "whatsapp:read", "whatsapp:write", "analytics:read",
    "ai:read"
  ],
  viewer: [
    "user:self", "tenant:read", "billing:read",
    "integration:read", "campaign:read", "contact:read",
    "lead:read", "deal:read", "pipeline:read",
    "whatsapp:read", "analytics:read"
  ],
};

export function can(role: Role, perm: Permission): boolean {
  const list = PERMISSIONS[role] ?? [];
  return list.some(p =>
    p === perm ||
    (p.endsWith(":*") && perm.startsWith(p.slice(0, -1)))
  );
}

export function hasPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.every(p => can(role, p));
}

export function getRolePermissions(role: Role): (Permission | WildcardPermission)[] {
  return PERMISSIONS[role] ?? [];
}

export function isOwnerOrAdmin(role: Role): boolean {
  return role === "owner" || role === "admin";
}

export function requirePermission(role: Role, perm: Permission): void {
  if (!can(role, perm)) {
    throw new Error(`FORBIDDEN: role '${role}' lacks permission '${perm}'`);
  }
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 100,
  admin: 80,
  member: 50,
  viewer: 10,
};

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}