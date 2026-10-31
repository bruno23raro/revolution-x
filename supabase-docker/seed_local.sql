-- Seed local de teste: usuario admin + organizacao + membership
-- Idempotente (ON CONFLICT DO NOTHING).
BEGIN;

-- Organizacao local
INSERT INTO "Organization" (id, name, slug, status, "createdAt", "updatedAt")
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Revolution X Local',
  'rx-local',
  'active',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Usuario (mesmo id do GoTrue criado via /auth/v1/admin/users)
INSERT INTO "User" (id, email, name, "passwordHash", "emailVerified", "createdAt", "updatedAt")
VALUES (
  'dd6d5118-5122-4ed0-86fc-2e1f8db6423c',
  'admin@revx.local',
  'Admin Local',
  '$2a$12$bYdXZ9Q30E11kHO9lRlslOLqbrP9IW3dMuKnGAY2WVxoprTlmk7iO',
  true,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Membership admin na organizacao
INSERT INTO "OrganizationMember" (id, "organizationId", "userId", role, "joinedAt")
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'dd6d5118-5122-4ed0-86fc-2e1f8db6423c',
  'admin',
  now()
)
ON CONFLICT ("organizationId", "userId") DO NOTHING;

COMMIT;

SELECT 'users' AS t, count(*) FROM "User"
UNION ALL SELECT 'orgs', count(*) FROM "Organization"
UNION ALL SELECT 'members', count(*) FROM "OrganizationMember";
