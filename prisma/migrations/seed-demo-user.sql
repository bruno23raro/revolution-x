-- Migration: Adicionar usuário e dados demo para ambiente de desenvolvimento
-- Executar apenas no stack local (localhost)
-- Este migration cria os dados necessários para o modo demo funcionar

-- IDs demo fixos (devem ser idênticos aos de src/lib/demoMode.ts)
-- DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'
-- DEMO_ORG_ID = '00000000-0000-0000-0000-000000000002'

-- Inserir usuário demo (se não existir)
-- Observação: passwordHash é um hash vazio pois o usuário demo NÃO usa login real
-- Apenas o token JWT demo (is_demo: true) é usado para autenticação
INSERT INTO "User" (id, email, "emailVerified", name, "passwordHash")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@revolutionx.dev',
  true,
  'Demo User',
  '$2a$12$demo_is_a_mock_user_password_hash_for_demo_only'
)
ON CONFLICT (id) DO UPDATE
SET email = 'demo@revolutionx.dev', "emailVerified" = true, name = 'Demo User';

-- Inserir organização demo (se não existir)
INSERT INTO "Organization" (id, name, slug, status)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Organização Demo',
  'demo-org',
  'active'
)
ON CONFLICT (id) DO UPDATE
SET name = 'Organização Demo', slug = 'demo-org', status = 'active';

-- Inserir membership admin demo
INSERT INTO "OrganizationMember" (organizationId, "userId", role)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'admin'
)
ON CONFLICT (organizationId, userId) DO UPDATE
SET role = 'admin';