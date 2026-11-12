# Script PowerShell para aplicar migration 029 em produção
# Aplica correção RLS na tabela integration_events

param(
    [switch]$DryRun = $false,
    [switch]$Force = $false
)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  APLICAÇÃO MIGRATION 029 - CORREÇÃO RLS INTEGRATION_EVENTS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se temos psql
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    Write-Host "❌ psql não encontrado no PATH" -ForegroundColor Red
    Write-Host "   Tente: winget install postgres" -ForegroundColor Yellow
    exit 1
}

# Credenciais de conexão à produção
$DB_HOST = "db.ardpabjoepzhkpmkgwgu.supabase.co"
$DB_PORT = "5432"
$DB_NAME = "postgres"
$DB_USER = "postgres"
# Senha: definir via variável de ambiente SUPABASE_DB_PASSWORD ou PGPASSWORD
$DB_PASSWORD = $env:SUPABASE_DB_PASSWORD

Write-Host "📍 Banco de Dados: $DB_HOST:$DB_PORT/$DB_NAME" -ForegroundColor Gray
Write-Host "🔐 Usuário: $DB_USER" -ForegroundColor Gray
Write-Host ""

# SQL da migration 029
$sql = @"
-- Migration 029: Correção RLS para integration_events
-- Estratégia: Forward-only, idempotente

-- 1. Verificar se a tabela existe
DO \$\$
DECLARE table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_events') INTO table_exists;
  IF NOT table_exists THEN
    RAISE EXCEPTION 'Tabela integration_events não existe';
  END IF;
END \$\$;

-- 2. Habilitar RLS se não estiver habilitado
DO \$\$
DECLARE rls_enabled BOOLEAN;
BEGIN
  SELECT rowsecurity INTO rls_enabled FROM pg_tables WHERE tablename = 'integration_events';
  IF NOT rls_enabled THEN
    ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS habilitado';
  END IF;
END \$\$;

-- 3. Habilitar FORCE RLS
ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;

-- 4. Política de tenant (idempotente)
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_events' AND policyname = 'integration_events_tenant')
  THEN
    CREATE POLICY integration_events_tenant ON integration_events
      FOR ALL TO PUBLIC
      USING (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
      WITH CHECK (workspace_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
  END IF;
END \$\$;

-- 5. Política para service_role (idempotente)
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_events' AND policyname = 'integration_events_service_role')
  THEN
    CREATE POLICY integration_events_service_role ON integration_events
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END \$\$;

-- Comentários para documentação
COMMENT ON TABLE integration_events IS 'Trilha de auditoria de eventos de integração (conexão, erro, renovação, troca de modo)';
COMMENT ON COLUMN integration_events.event_type IS 'Tipo do evento: connection_success, connection_failed, disconnection, credential_renewal, mode_switch, error';
COMMENT ON POLICY integration_events_tenant IS 'Multi-tenant isolation: only events belonging to current tenant accessible via app.current_org GUC';
COMMENT ON POLICY integration_events_service_role IS 'Service role bypass for admin operations (webhooks, onboarding, admin tasks)';

SELECT 'Migration 029 aplicada com sucesso' as result;
"@

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  ⚠️  ATENÇÃO: APLICAÇÃO EM PRODUÇÃO" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

if (-not $Force) {
    $confirmation = Read-Host "Tem certeza? Digite 'SIM' para confirmar"
    if ($confirmation -ne 'SIM') {
        Write-Host "❌ Operação cancelada pelo usuário" -ForegroundColor Yellow
        exit 0
    }
}

if ($DryRun) {
    Write-Host "📝 Modo DRY-RUN - SQL que seria executado:" -ForegroundColor Blue
    Write-Host ""
    Write-Host $sql
    exit 0
}

Write-Host ""
Write-Host "Executando migration 029..." -ForegroundColor Green
Write-Host ""

# Salvar SQL em arquivo temporário
$tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
Set-Content -Path $tempFile -Value $sql -Encoding UTF8

try {
    # Executar via psql
    $result = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $tempFile 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration 029 aplicada com sucesso!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Verificando estado..." -ForegroundColor Gray

        # Verificar RLS
        $rlsCheck = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT rowsecurity FROM pg_tables WHERE tablename = 'integration_events';" 2>&1
        Write-Host "   RLS habilitado: $rlsCheck"

        # Verificar policies
        $policyCheck = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM pg_policies WHERE tablename = 'integration_events';" 2>&1
        Write-Host "   Policies: $policyCheck"

        Write-Host ""
        Write-Host "🎉 Correção RLS concluída na produção!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Erro ao aplicar migration:" -ForegroundColor Red
        Write-Host $result
        exit 1
    }
} catch {
    Write-Host "❌ Erro: $_" -ForegroundColor Red
    exit 1
} finally {
    # Limpar arquivo temporário
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Próximos passos:" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "1. Verificar logs da aplicação para erros"
Write-Host "2. Testar isolamento multi-tenant"
Write-Host "3. Executar testes E2E"
Write-Host ""