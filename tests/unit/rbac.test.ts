import { can, hasPermission, getRolePermissions, isOwnerOrAdmin, requirePermission, canManageRole, ROLE_HIERARCHY } from "@/lib/auth/rbac";
import type { Role, Permission } from "@/lib/auth/rbac";

describe("rbac", () => {
  const roles: Role[] = ["owner", "admin", "member", "viewer"];

  it("owner has all permissions", () => {
    const perms = getRolePermissions("owner");
    expect(perms).toContain("user:*");
    expect(perms).toContain("tenant:*");
    expect(perms).toContain("billing:*");
    expect(perms).toContain("integration:*");
    expect(perms).toContain("campaign:*");
    expect(perms).toContain("contact:*");
    expect(perms).toContain("lead:*");
    expect(perms).toContain("deal:*");
    expect(perms).toContain("pipeline:*");
    expect(perms).toContain("whatsapp:*");
    expect(perms).toContain("analytics:*");
    expect(perms).toContain("admin:*");
    expect(perms).toContain("webhook:*");
    expect(perms).toContain("ai:*");
  });

  it("admin has write access to most resources except user management", () => {
    expect(can("admin", "tenant:write")).toBe(true);
    expect(can("admin", "campaign:write")).toBe(true);
    expect(can("admin", "contact:write")).toBe(true);
    expect(can("admin", "lead:write")).toBe(true);
    expect(can("admin", "deal:write")).toBe(true);
    expect(can("admin", "pipeline:write")).toBe(true);
    expect(can("admin", "whatsapp:write")).toBe(true);
    expect(can("admin", "ai:write")).toBe(true);
    expect(can("admin", "user:*")).toBe(false);
    expect(can("admin", "user:self")).toBe(true);
  });

  it("member has read/write on CRM, read on others", () => {
    expect(can("member", "campaign:read")).toBe(true);
    expect(can("member", "campaign:write")).toBe(true);
    expect(can("member", "contact:read")).toBe(true);
    expect(can("member", "contact:write")).toBe(true);
    expect(can("member", "lead:read")).toBe(true);
    expect(can("member", "lead:write")).toBe(true);
    expect(can("member", "deal:read")).toBe(true);
    expect(can("member", "deal:write")).toBe(true);
    expect(can("member", "pipeline:read")).toBe(true);
    expect(can("member", "pipeline:write")).toBe(false);
    expect(can("member", "whatsapp:read")).toBe(true);
    expect(can("member", "whatsapp:write")).toBe(true);
    expect(can("member", "analytics:read")).toBe(true);
    expect(can("member", "billing:read")).toBe(true);
    expect(can("member", "billing:write")).toBe(false);
  });

  it("viewer has read-only access", () => {
    expect(can("viewer", "tenant:read")).toBe(true);
    expect(can("viewer", "tenant:write")).toBe(false);
    expect(can("viewer", "campaign:read")).toBe(true);
    expect(can("viewer", "campaign:write")).toBe(false);
    expect(can("viewer", "contact:read")).toBe(true);
    expect(can("viewer", "contact:write")).toBe(false);
    expect(can("viewer", "analytics:read")).toBe(true);
    expect(can("viewer", "billing:read")).toBe(true);
    expect(can("viewer", "whatsapp:read")).toBe(true);
    expect(can("viewer", "whatsapp:write")).toBe(false);
  });

  it("wildcard permissions match correctly for owner", () => {
    expect(can("owner", "contact:read")).toBe(true);
    expect(can("owner", "contact:write")).toBe(true);
    expect(can("owner", "contact:delete")).toBe(true);
    expect(can("owner", "campaign:read")).toBe(true);
    expect(can("owner", "campaign:write")).toBe(true);
    expect(can("owner", "campaign:delete")).toBe(true);
  });

  it("admin wildcard matches specific actions within granted wildcards", () => {
    expect(can("admin", "campaign:read")).toBe(true);
    expect(can("admin", "campaign:write")).toBe(true);
    // admin has campaign:read and campaign:write explicitly, not campaign:*
    expect(can("admin", "campaign:delete")).toBe(false);
  });

  it("hasPermission validates all permissions", () => {
    expect(hasPermission("admin", ["campaign:read", "contact:write", "lead:read"])).toBe(true);
    expect(hasPermission("member", ["campaign:read", "contact:write", "billing:write"])).toBe(false);
  });

  it("isOwnerOrAdmin returns correct values", () => {
    expect(isOwnerOrAdmin("owner")).toBe(true);
    expect(isOwnerOrAdmin("admin")).toBe(true);
    expect(isOwnerOrAdmin("member")).toBe(false);
    expect(isOwnerOrAdmin("viewer")).toBe(false);
  });

  it("requirePermission throws on missing permission", () => {
    expect(() => requirePermission("member", "billing:write")).toThrow("FORBIDDEN");
    expect(() => requirePermission("viewer", "campaign:write")).toThrow("FORBIDDEN");
    expect(() => requirePermission("admin", "tenant:write")).not.toThrow();
  });

  it("role hierarchy is correct", () => {
    expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.member);
    expect(ROLE_HIERARCHY.member).toBeGreaterThan(ROLE_HIERARCHY.viewer);
  });

  it("canManageRole respects hierarchy", () => {
    expect(canManageRole("owner", "admin")).toBe(true);
    expect(canManageRole("admin", "member")).toBe(true);
    expect(canManageRole("member", "viewer")).toBe(true);
    expect(canManageRole("viewer", "member")).toBe(false);
    expect(canManageRole("member", "admin")).toBe(false);
    expect(canManageRole("admin", "owner")).toBe(false);
  });

  it("explicit denial for unknown roles", () => {
    expect(can("unknown" as Role, "tenant:read")).toBe(false);
  });
});