-- Migration 013: Sincroniza identidades de auth.users para public."User"
-- Idempotente: insere apenas usuários que ainda não existem em public."User"

INSERT INTO "public"."User" (
    id,
    email,
    name,
    "passwordHash",
    "emailVerified",
    "createdAt",
    "updatedAt"
)
SELECT
    u.id,
    u.email,
    u.email,
    'placeholder_migrated_user',
    true,
    u.created_at,
    u.updated_at
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."User" WHERE id = u.id
);
