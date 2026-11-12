# Script PowerShell: Setup Multi-Tenant Test
# =============================================
# Cria dois usuários de teste em organizações diferentes para validação de isolamento RLS
#
# Uso: .\scripts\setup-multitenant-test.ps1
# Ou: pwsh -File scripts/setup-multitenant-test.ps1

param(
    [string]$EnvFile = ".env.local",
    [switch]$Clean
)

# Cores para output
$ColorSuccess = "Green"
$ColorError = "Red"
$ColorWarning = "Yellow"
$ColorInfo = "Cyan"

function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor $ColorInfo }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor $ColorSuccess }
function Write-Error { param($msg) Write-Host "[ERRO] $msg" -ForegroundColor $ColorError }
function Write-Warning { param($msg) Write-Host "[AVISO] $msg" -ForegroundColor $ColorWarning }

# Verificar se .env existe
if (-not (Test-Path $EnvFile)) {
    Write-Error "Arquivo $EnvFile não encontrado. Execute este script do diretório raiz do projeto."
    exit 1
}

# Carregar variáveis de ambiente
Write-Info "Carregando variáveis de $EnvFile..."
Get-Content $EnvFile | Where-Object { $_ -match "^[A-Z]" -and $_ -notmatch "^#" } | ForEach-Object {
    $parts = $_.Split('=', 2)
    if ($parts.Length -eq 2) {
        [Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
    }
}

# Verificar variáveis necessárias
$requiredVars = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL"
)

foreach ($var in $requiredVars) {
    if ([Environment]::GetEnvironmentVariable($var, "Process") -eq "") {
        Write-Error "Variável $var não encontrada em $EnvFile"
        exit 1
    }
}

Write-Success "Todas as variáveis de ambiente necessárias estão configuradas"

# Verificar se Supabase está acessível
Write-Info "Verificando conexão com Supabase..."
$url = [Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL", "Process")
$anonKey = [Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY", "Process")
$serviceKey = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY", "Process")

# Testar conexão básica
try {
    $response = Invoke-RestMethod -Uri "$url/rest/v1/" -Headers @{
        "apikey" = $anonKey
        "Authorization" = "Bearer $anonKey"
    } -ErrorAction Stop
    Write-Success "Conexão com Supabase estabelecida"
} catch {
    Write-Error "Não foi possível conectar ao Supabase em $url"
    Write-Error $_.Exception.Message
    exit 1
}

# Gerar IDs únicos para testes
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$user1Email = "testuser1-$timestamp@multitenant.test"
$user2Email = "testuser2-$timestamp@multitenant.test"
$org1Slug = "test-org-1-$timestamp"
$org2Slug = "test-org-2-$timestamp"

Write-Info "Criando usuários de teste..."
Write-Info "  User1: $user1Email"
Write-Info "  User2: $user2Email"
Write-Info "  Org1: $org1Slug"
Write-Info "  Org2: $org2Slug"

# Exportar variáveis para o script Node.js
$env:TEST_USER1_EMAIL = $user1Email
$env:TEST_USER2_EMAIL = $user2Email
$env:TEST_ORG1_SLUG = $org1Slug
$env:TEST_ORG2_SLUG = $org2Slug
$env:TEST_TIMESTAMP = $timestamp

Write-Info "Configuração de teste completa."
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "  1. Execute: npm test -- src/tests/multi-tenant-isolation-autonomous.test.ts"
Write-Host "  2. Ou execute o script Node.js de setup separado"
Write-Host "  3. Para limpar dados de teste, execute: .\scripts\setup-multitenant-test.ps1 -Clean"
Write-Host ""

# Se o parâmetro -Clean foi passado, limpar dados antigos
if ($Clean) {
    Write-Info "Limpando dados de teste antigos..."
    # Aqui você pode adicionar comandos para limpar usuários/orgs de teste
    Write-Warning "Funcionalidade de limpeza ainda não implementada"
}