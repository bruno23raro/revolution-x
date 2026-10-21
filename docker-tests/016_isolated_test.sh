#!/usr/bin/env bash
# ============================================================================
# TESTE ISOLADO DA MIGRAÇÃO 016 (multicontas Meta) — banco DESCARTÁVEL local
#
# Roda contra um BANCO DE TESTE LOCAL (o `db` do compose.test.yaml, ou qualquer
# Postgres 17 local). NUNCA toca o Supabase de produção.
#
# Prova, na ordem:
#   1) ANTES do 016: UNIQUE(organization_id, provider) TRAVA a 2ª conta do
#      mesmo provedor na mesma org (comportamento legado do 005).
#   2) APLICA 016 (arquivo real supabase/migrations/016_multi_meta_accounts.sql):
#      adiciona display_name, remove o UNIQUE de 2 colunas, e cria 2 índices de
#      expressão (uq_meta_integrations_account / uq_meta_integrations_page).
#   3) DEPOIS do 016:
#        • 2 contas do MESMO provedor na MESMA org (meta_page distinta) → AGORA OK
#        • duplicata EXATA da mesma conta (mesmo meta_page_id) → ainda FALHA
#        • mesma página em OUTRA org → OK (isolamento multi-tenant)
#        • 2 linhas PENDING sem nenhum id → OK (NULLs não colidem)
#        • display_name preenchida (backfill 'Página <id>')
#        • constraint antiga removida + novos índices presentes
#
# Uso (após o `db` do compose.test.yaml estar no ar):
#   cd <repo>
#   DB=revolution-x-test-db-1
#   docker exec -i $DB psql -U revx -d postgres -c "DROP DATABASE IF EXISTS meta016_test; CREATE DATABASE meta016_test;"
#   docker exec -i $DB psql -U revx -d meta016_test -v ON_ERROR_STOP=1 -f ... (abaixo, passo a passo)
#
# Este script-documentação mostra os comandos; a execução real é feita passo a
# passo (ver FINAL_READINESS_REPORT.md) para capturar cada resultado.
# ============================================================================
set -uo pipefail

DB="meta016_test"   # banco efêmero de teste (NÃO é o do app, NÃO é produção)

echo "### 0) recria banco de teste vazio"
docker exec -i "$DB_CONTAINER" psql -U revx -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS ${DB};" -c "CREATE DATABASE ${DB};"

echo "### fixture: organizations (alvo do FK)"
docker exec -i "$DB_CONTAINER" psql -U revx -d "$DB" -v ON_ERROR_STOP=1 \
  -c "CREATE TABLE organizations(id UUID PRIMARY KEY);" \
  -c "INSERT INTO organizations(id) VALUES
       ('11111111-1111-1111-1111-111111111111'),
       ('22222222-2222-2222-2222-222222222222');"

echo "### aplica 005 (meta_integrations com UNIQUE(org, provider))"
cat supabase/migrations/005_meta_integrations.sql | \
  docker exec -i "$DB_CONTAINER" psql -U revx -d "$DB" -v ON_ERROR_STOP=1

ORGA='11111111-1111-1111-1111-111111111111'
ORGB='22222222-2222-2222-2222-222222222222'
TOK='enc-fixture-0'   # sintético, NÃO é um token real

echo "### 1) 1ª conta facebook na org A → OK"
docker exec -i "$DB_CONTAINER" psql -U revx -d "$DB" -v ON_ERROR_STOP=1 -tA \
  -c "INSERT INTO meta_integrations(id, organization_id, provider, meta_page_id,
       encrypted_access_token, status)
      VALUES ('33333333-3333-3333-3333-333333333333', '$ORGA','facebook','PAGE_A_1',
       '$TOK','CONNECTED');"

echo "### 2) 2ª conta do MESMO provedor na MESMA org → ESPERA-SE FALHA (antes do 016)"
docker exec -i "$DB_CONTAINER" psql -U revx -d "$DB" -v ON_ERROR_STOP=1 -tA \
  -c "INSERT INTO meta_integrations(id, organization_id, provider, meta_page_id,
       encrypted_access_token, status)
      VALUES ('44444444-4444-4444-4444-444444444444', '$ORGA','facebook','PAGE_A_2',
       '$TOK','CONNECTED');" 2>&1   # deve lançar: meta_integrations_organization_id_provider_key

echo "### 3) APLICA 016 (arquivo real)"
cat supabase/migrations/016_multi_meta_accounts.sql | \
  docker exec -i "$DB_CONTAINER" psql -U revx -d "$DB" -v ON_ERROR_STOP=1

echo "### 4) AGORA: 2ª conta do mesmo provedor na mesma org → ESPERA-SE OK"
docker exec -i "$DB_CONTAINER" psql -U revx -d "$DB" -v ON_ERROR_STOP=1 -tA \
  -c "INSERT INTO meta_integrations(id, organization_id, provider, meta_page_id,
       encrypted_access_token, status, display_name)
      VALUES ('44444444-4444-4444-4444-444444444444', '$ORGA','facebook','PAGE_A_2',
       '$TOK','CONNECTED','Página PAGE_A_2');"

echo "### 5) duplicata EXATA da mesma conta → ESPERA-SE FALHA (índice de expressão)"
docker exec -i "$DB_CONTAINER" psql -U revx -d "$DB" -v ON_ERROR_STOP=1 -tA \
  -c "INSERT INTO meta_integrations(id, organization_id, provider, meta_page_id,
       encrypted_access_token, status)
      VALUES ('55555555-5555-5555-5555-555555555555', '$ORGA','facebook','PAGE_A_1',
       '$TOK','CONNECTED');" 2>&1   # deve lançar: uq_meta_integrations_account

echo "### 6) mesma página em OUTRA org → ESPERA-SE OK (isolamento)"
docker exec -i "$DB_CONTAINER" psql -U revx -d "$DB" -v ON_ERROR_STOP=1 -tA \
  -c "INSERT INTO meta_integrations(id, organization_id, provider, meta_page_id,
       encrypted_access_token, status)
      VALUES ('66666666-6666-6666-6666-666666666666', '$ORGB','facebook','PAGE_A_1',
       '$TOK','CONNECTED');"

echo "### 7) 2 PENDING sem id na mesma org → ESPERA-SE OK (NULL não colide)"
docker exec -i "$DB_CONTAINER" psql -U revx -d "$DB" -v ON_ERROR_STOP=1 -tA \
  -c "INSERT INTO meta_integrations(id, organization_id, provider,
       encrypted_access_token, status)
      VALUES ('77777777-7777-7777-7777-777777777777','$ORGA','whatsapp','$TOK','PENDING'),
             ('88888888-8888-8888-8888-888888888888','$ORGA','whatsapp','$TOK','PENDING');"

echo "### 8) estado final"
echo "contas facebook na org A (esperado 2):"
docker exec -i "$DB_CONTAINER" psql -U revx -d "$DB" -tA \
  -c "SELECT count(*) FROM meta_integrations WHERE organization_id='$ORGA' AND provider='facebook';"
echo "constraint antiga (esperado 0):"
docker exec -i "$DB_CONTAINER" psql -U revx -d "$DB" -tA \
  -c "SELECT count(*) FROM pg_constraint WHERE conname='meta_integrations_organization_id_provider_key';"
echo "novos índices (esperado 2):"
docker exec -i "$DB_CONTAINER" psql -U revx -d "$DB" -tA \
  -c "SELECT indexname FROM pg_indexes WHERE tablename='meta_integrations'
        AND indexname IN ('uq_meta_integrations_account','uq_meta_integrations_page') ORDER BY indexname;"
echo "backfill display_name (esperado 'Página PAGE_A_1'):"
docker exec -i "$DB_CONTAINER" psql -U revx -d "$DB" -tA \
  -c "SELECT display_name FROM meta_integrations WHERE meta_page_id='PAGE_A_1' AND organization_id='$ORGA';"

echo "### LIMPEZA: remove banco efêmero (volume do app intacto)"
docker exec -i "$DB_CONTAINER" psql -U revx -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS ${DB};"
echo "fim do teste isolado da 016."
