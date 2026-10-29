# Supabase self-hosted local (dev)

Stack oficial do Supabase em Docker com segredos ROTACIONADOS (nada das demo keys).

## Portas (host)
| Serviço | Porta | Nota |
|---|---|---|
| API gateway (Envoy) | **8432** | `/auth/v1`, `/rest/v1`, `/storage/v1`, `/realtime/v1`, `/functions/v1` |
| Postgres via Supavisor (transaction) | **54320** | username precisa sufixo tenant: `postgres.revx-local` |
| Postgres direto (sem pooler) | **54321** | use p/ prisma/migrations |
| Pooler porta 6543-equivalente | **65430** | |
| Studio | via 8432 `/` | basic-auth `admin` (senha em `.env`) |

## Comandos
```powershell
cd supabase-docker
docker compose up -d          # sobe tudo (11 containers)
docker compose ps             # saúde
docker compose down           # para (dados persistem em volumes/db/data)
node gen-secrets.mjs | Out-File .secrets.json -Encoding ascii; node make-env.mjs   # rotaciona TUDO (requer wipe db/data)
```

## Migrações (já aplicadas nesta ordem)
1. `prisma_init_norx.sql` — DDL canônico PascalCase (gerado com `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`, sem meta_integrations/webhook_events)
2. `supabase/dev_apply/002a_supabase_base.sql` — base snake (organizations, plans…)
3. `fix_005.sql` → 006 (`fix_006.sql`) → 007 → 008 → 009 → 013 → 014 → 015 → 016 → 017 → 018
   - `fix_005` corrige política RLS quebrada do 005 original (`organization_id current_setting` → `organization_id = current_setting`)
   - `fix_006` torna os guards de constraint idempotentes também p/ UNIQUE indexes (pg_class)
4. SQL pela porta direta: `docker exec supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres -p 54320 -f …`

## App apontando p/ cá
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8432
SUPABASE_URL=http://localhost:8432
SUPABASE_ANON_KEY=<ANON_KEY do .env daqui>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY do .env daqui>
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@localhost:54321/postgres
```
Segredos vivem em `supabase-docker/.env` (git-ignored). Nunca commitar `.env`/`.secrets.json`.

## Smoke test validado (2026-10-29)
- `GET :8432/auth/v1/health` (sem apikey) → 401 (exige key: ok)
- `GET :8432/rest/v1/organizations` anon → `[]` (RLS fail-closed ok)
- service_role → 200; signup GoTrue autoconfirm → linha em `auth.users` confirmada
- 40 tabelas em public, RLS ligado em 32, índices uq_meta_integrations_account/page + uq_webhook_events_meta_event_id presentes, UNIQUE legado (org,provider) ausente
