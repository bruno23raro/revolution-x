-- 1. Remove triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS RevolutionX ON "Revolution X";
DROP TRIGGER IF EXISTS trg_organizations_updated_at ON organizations;
DROP TRIGGER IF EXISTS trg_plans_updated_at ON plans;
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
DROP TRIGGER IF EXISTS trg_usage_updated_at ON usage;

-- 2. Remove views
DROP VIEW IF EXISTS users_view;
DROP VIEW IF EXISTS countries_view;

-- 3. Delete demo data (order respects FKs)
DELETE FROM comments;
DELETE FROM posts;
DELETE FROM profiles;
DELETE FROM users;

-- 4. Drop residual tables
DROP TABLE IF EXISTS billing_events, usage, subscriptions, organization_members, roles, permissions, organizations, plans;
DROP TABLE IF EXISTS "Revolution X", countries, table_name;
