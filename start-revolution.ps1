<#
.SYNOPSIS
Autostart script for Revolution X project.
Detects FreeLLMAPI, validates Claude Code configuration, and starts the development server.
IMPORTANT: Uses docker compose to manage FreeLLMAPI local runtime only. Does not alter production config.
Do NOT configure production to use FreeLLMAPI. Do not alter production env vars to point to localhost.
#>

# Set strict error handling
$ErrorActionPreference = 'Stop'

# Project directory
$projectDir = "C:\Users\Bruno\.claude\Revolution\X"

# Ensure log directory exists
$logDir = Join-Path $projectDir "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logFile = Join-Path $logDir "autostart.log"

function Write-Log {
    param([string]$message, [string]$level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $logEntry = "[$timestamp] [$level] $message"
    Write-Host $logEntry
    Add-Content -Path $logFile -Value $logEntry
}

Write-Log "==========================================" "START"
Write-Log "Revolution X Autostart Script" "START"
Write-Log "==========================================" "START"

# ============================================================
# Step 0: Backup existing config before changes
# ============================================================
Write-Log "Step 0: Fazendo backup das configurações existentes..." "INFO"

$backupDir = Join-Path $projectDir "logs/autostart-backup-$((Get-Date).ToString('yyyyMMdd-HHmmss'))"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}
# Backup any existing .env or config references
$envFiles = @("C:\Users\Bruno\.claude\Revolution\X\.env", "C:\Users\Bruno\.claude\Revolution\X\.env.local")
foreach ($ef in $envFiles) {
    if (Test-Path $ef) {
        $bakFileName = [System.IO.Path]::GetFileNameWithoutExtension($ef) + ".bak"
        $bak = Join-Path $backupDir $bakFileName
        Copy-Item -Path $ef -Destination $bak -Force 2>$null
        Write-Log "Fazendo backup de $ef para $bak" "INFO"
    }
}

# Also backup the current script
$scriptBak = Join-Path $backupDir "start-revolution.ps1.bak"
Copy-Item -Path $MyInvocation.MyCommand.Path -Destination $scriptBak -Force 2>$null
Write-Log "Backup do script criado em $scriptBak" "INFO"

# ============================================================
# Step 1: Start FreeLLMAPI via Docker Compose if stopped
# ============================================================
Write-Log "Step 1: Verificando e iniciando FreeLLMAPI via Docker Compose..." "INFO"

$freellmapiComposeFile = "C:\Users\Bruno\FreeLLMAPI\docker-compose.yml"

# Check if FreeLLMAPI container is already running
$dockerPsResult = & docker ps --filter "name=freellmapi" --format "{{.Names}} {{.Status}}" 2>&1
$containerRunning = $false

if ($dockerPsResult -match "freellmapi") {
    Write-Log "Container FreeLLMAPI já está em execução" "INFO"
    $containerRunning = $true
}

if (-not $containerRunning) {
    Write-Log "Iniciando container FreeLLMAPI..." "INFO"

    # Change to the FreeLLMAPI directory and start with docker compose
    $origDir = Get-Location
    try {
        Set-Location "C:\Users\Bruno\FreeLLMAPI"

        # Check if docker compose file exists
        if (Test-Path $freellmapiComposeFile) {
            Write-Log "Executando: docker compose -f C:\Users\Bruno\FreeLLMAPI\docker-compose.yml up -d" "INFO"
            $dockerUpResult = & docker compose -f $freellmapiComposeFile up -d 2>&1
            Write-Log "Resultado docker compose: $($dockerUpResult.Substring(0, [Math]::Min($dockerUpResult.Length, 500)))" "INFO"
        } else {
            Write-Log "AVISO: docker-compose.yml nao encontrado em $freellmapiComposeFile" "WARN"
            Write-Log "Projeto configurado para Gemini direto (sem FreeLLMAPI)" "INFO"
        }
    } finally {
        Set-Location $origDir
    }

    # Wait for container to be healthy
    Write-Log "Aguardando FreeLLMAPI ficar saudavel..." "INFO"
    $maxWait = 60
    $waited = 0

    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 2
        $waited += 2

        $healthCheck = & docker inspect -f '{{.State.Health.Status}}' freellmapi 2>$null
        if ($healthCheck -eq "healthy") {
            Write-Log "FreeLLMAPI container saudavel apos $waited segundos" "INFO"
            break
        }

        # Also check HTTP health endpoint
        try {
            $resp = Invoke-RestMethod -Uri "http://127.0.0.1:3001/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($resp -ne $null) {
                Write-Log "FreeLLMAPI saudavel via HTTP apos $waited segundos" "INFO"
                break
            }
        } catch {
            # Not ready yet
        }
    }

    if ($waited -ge $maxWait) {
        Write-Log "AVISO: FreeLLMAPI nao ficou saudavel dentro de $maxWait segundos" "WARN"
        Write-Log "Projeto continuara com Gemini direto" "INFO"
    }
} else {
    Write-Log "FreeLLMAPI ja estava rodando - verificando conectividade..." "INFO"
}

# Verify FreeLLMAPI is reachable via HTTP
$freeLLMAPIUrl = "http://127.0.0.1:3001/health"
$freeLLMAPIAvailable = $false

try {
    $response = Invoke-RestMethod -Uri $freeLLMAPIUrl -Method Get -TimeoutSec 5
    if ($response -ne $null) {
        $freeLLMAPIAvailable = $true
        Write-Log "FreeLLMAPI saudavel respondendo em $freeLLMAPIUrl" "INFO"
    }
} catch {
    Write-Log "FreeLLMAPI nao acessivel em $freeLLMAPIUrl ($($_.Exception.Message))" "WARN"
    Write-Log "Projeto configurado para Gemini direto (sem OmniRouter)" "INFO"
}

# ============================================================
# Step 2: Verify Claude Code configuration
# ============================================================
Write-Log "Step 2: Verificando configuracao do Claude Code..." "INFO"

# Check process-scoped environment variables (these are harness-injected, not persisted)
$anthropicBaseUrl = $env:ANTHROPIC_BASE_URL
$anthropicAuthToken = $env:ANTHROPIC_AUTH_TOKEN
$anthropicModel = $env:ANTHROPIC_MODEL

Write-Log "ANTHROPIC_BASE_URL: $anthropicBaseUrl" "INFO"
Write-Log "ANTHROPIC_AUTH_TOKEN: $(if (-not $anthropicAuthToken) {'Nao definido'} {'Definido (process-scope)'})" "INFO"
Write-Log "ANTHROPIC_MODEL: $anthropicModel" "INFO"

# Verify model compatibility
if ($anthropicModel -eq "auto" -or $anthropicModel -eq "fusion") {
    Write-Log "Modelo 'auto' ou 'fusion' detectado - catalog tem context_window:1048576" "INFO"
    Write-Log "Nota: Modelos free roteados podem ter window menor - verificar autocompact" "WARN"
} elseif ($anthropicModel -match "claude-") {
    Write-Log "Modelo claude-* detectado - verificando compatibilidade" "INFO"
}

# Check CLAUDE_CODE_AUTO_COMPACT_WINDOW
$compactWindow = $env:CLAUDE_CODE_AUTO_COMPACT_WINDOW
if ($compactWindow) {
    Write-Log "CLAUDE_CODE_AUTO_COMPACT_WINDOW: $compactWindow" "INFO"
} else {
    Write-Log "CLAUDE_CODE_AUTO_COMPACT_WINDOW: nao definido" "INFO"
}

# ============================================================
# Step 3: MCP Inventory and registration attempt
# ============================================================
Write-Log "Step 3: Inventario de MCPs e registro do FreeLLMAPI..." "INFO"

# Run claude mcp list and capture output
Write-Log "Executando: claude mcp list" "INFO"
$mcpListResult = & claude mcp list 2>&1
Write-Log $mcpListResult "INFO"

# Check if FreeLLMAPI MCP is already registered
if ($mcpListResult -match "freellmapi") {
    Write-Log "FreeLLMAPI MCP ja registrado" "INFO"
} else {
    Write-Log "FreeLLMAPI MCP nao registrado - attempting to enable and register..." "INFO"

    # FreeLLMAPI own MCP server is currently DISABLED (returns 403).
    # To enable via dashboard: Keys -> Agent compatibility page
    # To enable via API: PUT /api/settings/enable-mcp {"enabled":true}
    #   requires dashboard session token (FREELLMAPI_DASHBOARD_TOKEN or --token)
    # After enabling, register with:
    #   claude mcp add --transport http freellmapi http://localhost:3001/mcp \
    #     --header "Authorization: Bearer freellmapi-your-unified-key"

    Write-Log "AVISO: FreeLLMAPI MCP server esta DISABLED (403)" "WARN"
    Write-Log "Para habilitar via dashboard: Keys -> Agent compatibility" "INFO"
    Write-Log "Ou via API: PUT /api/settings/enable-mcp {\"enabled\":true}" "INFO"
    Write-Log "Depois registrar: claude mcp add --transport http freellmapi http://localhost:3001/mcp" "INFO"
}

# Document failed MCPs for honesty
Write-Log "MCPs com falha conhecida:" "INFO"
Write-Log "  supa: ENOTFOUND mcpservers.supabase.com (nao reachable)" "INFO"
Write-Log "  hermes: CONNECTION_CLOSED (connection refused)" "INFO"
Write-Log "  supabase (HTTP): needs authentication" "INFO"

# ============================================================
# Step 4: Run FreeLLMAPI doctor to verify routing
# ============================================================
Write-Log "Step 4: Executando doctor claude para verificar roteamento..." "INFO"

# Run freellmapi doctor claude to verify the routing chain
Write-Log "Executando: npx freellmapi doctor claude --url http://127.0.0.1:3001" "INFO"
$doctorResult = & npx freellmapi doctor claude --url http://127.0.0.1:3001 2>&1
$doctorExitCode = $LASTEXITCODE

Write-Log "Saida do doctor: $($doctorResult.Substring(0, [Math]::Min($doctorResult.Length, 500)))" "INFO"
Write-Log "Codigo de saida: $doctorExitCode" "INFO"

if ($doctorResult -match "OK claude") {
    Write-Log "Roteamento confirmado: FreeLLMAPI roteando corretamente para o modelo" "INFO"
} else {
    Write-Log "AVISO: Roteamento nao confirmado pelo doctor" "WARN"
}

# ============================================================
# Step 5: TypeScript and ESLint checks
# ============================================================
Write-Log "Step 5: Verificando TypeScript e ESLint..." "INFO"

Write-Log "Executando TypeScript check via npx..." "INFO"
$tscResult = & npx tsc --noEmit 2>&1
$tscExitCode = $LASTEXITCODE
if ($tscExitCode -eq 0) {
    Write-Log "TypeScript: 0 erros" "INFO"
} else {
    Write-Log "TypeScript: erros detectados" "WARN"
    $tscError = $tscResult.Substring(0, [Math]::Min($tscResult.Length, 300))
    Write-Log "TS errors: $tscError" "WARN"
}

Write-Log "Executando ESLint check via npx..." "INFO"
$eslintResult = & npx eslint . 2>&1
$eslintExitCode = $LASTEXITCODE
if ($eslintExitCode -eq 0) {
    Write-Log "ESLint: 0 erros" "INFO"
} else {
    Write-Log "ESLint: erros detectados" "WARN"
    $eslintError = $eslintResult.Substring(0, [Math]::Min($eslintResult.Length, 300))
    Write-Log "ESLint errors: $eslintError" "WARN"
}

# ============================================================
# Step 6: Check Google Gemini API key (direct provider)
# ============================================================
Write-Log "Step 6: Verificando configuracao do Gemini direto..." "INFO"

$googleApiKey = $env:GOOGLE_GENERATIVE_AI_API_KEY
if (-not $googleApiKey) {
    $googleApiKey = $env:AI_GOOGLE_API_KEY
}
if (-not $googleApiKey) {
    $googleApiKey = $env:GOOGLE_API_KEY
}

if ($googleApiKey) {
    Write-Log "Chave API Gemini encontrada no ambiente" "INFO"
    $keyLength = $googleApiKey.Length
    $keyPreview = $googleApiKey.Substring(0, [Math]::Min($keyLength, 8))
    Write-Log "Chave comeca com: $keyPreview" "INFO"
} else {
    Write-Log "Aviso: Nenhuma chave API Google encontrada nas variaveis de ambiente" "WARN"
    Write-Log "Os testes de IA funcionarao como 'bloqueado honesto' (503 ok:false)" "INFO"
}

# ============================================================
# Step 7: Start development server
# ============================================================
Write-Log "Step 7: Iniciando servidor Next.js ..." "INFO"

Write-Log "Executando: npx next dev" "INFO"
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npx", "next dev" -PassThru -NoNewWindow

Write-Log "Servidor Next.js iniciado (PID: $($proc.Id))" "INFO"
Write-Log "Acesse: http://localhost:3000" "INFO"
Write-Log "Admin: http://localhost:3000/admin" "INFO"

# Wait a moment for server to start
Start-Sleep -Seconds 5

# Verify server is responding
$serverReady = $false
$maxWait = 30
$waited = 0

Write-Log "Aguardando servidor ficar pronto (ate $maxWait segundos)..." "INFO"

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++

    try {
        $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($health -ne $null) {
            $serverReady = $true
            Write-Log "Servidor pronto apos $waited segundos" "INFO"
            break
        }
    } catch {
        # Server not ready yet - continue waiting
    }
}

# ============================================================
# Final status
# ============================================================
Write-Log "==========================================" "END"
Write-Log "Revolution X Autostart Script finalizado" "END"

# ============================================================
# Summary output (visible in terminal)
# ============================================================
Write-Host ""
Write-Host "=========================================="
Write-Host "Revolution X Autostart - Resumo"
Write-Host "=========================================="

# FreeLLMAPI status
if ($freeLLMAPIAvailable) {
    Write-Host "FreeLLMAPI: Disponivel"
} else {
    Write-Host "FreeLLMAPI: Nao disponivel (projeto usa Gemini direto)"
    Write-Log "  Projeto configurado para Gemini direto (sem OmniRouter)" "INFO"
}

Write-Host "Node.js: $nodeVersion"
Write-Host "npm: $npmVersion"

# TypeScript
if ($tscExitCode -eq 0) {
    Write-Host "TypeScript: 0 erros"
} else {
    Write-Host "TypeScript: erros detectados"
}

# ESLint
if ($eslintExitCode -eq 0) {
    Write-Host "ESLint: 0 erros"
} else {
    Write-Host "ESLint: erros detectados"
}

# Gemini API Key
if ($googleApiKey) {
    $keyLength = $googleApiKey.Length
    $keyPreview = $googleApiKey.Substring(0, [Math]::Min($keyLength, 8))
    Write-Host "Gemini API Key: Configurada (comeca com: $keyPreview...)"
} else {
    Write-Host "Gemini API Key: Nao encontrada"
}

Write-Host "Servidor: http://localhost:3000"
Write-Host "=========================================="

# ============================================================
# Resume hook - checkpoint for next session
# ============================================================
Write-Log "=== Checkpoint gravado ===" "START"
Write-Log "FreeLLMAPI status: $(if ($freeLLMAPIAvailable) {'disponivel'} {'indisponivel (Gemini direto)'})" "INFO"
Write-Log "Modelo ativo: $anthropicModel" "INFO"
Write-Log "CLAUDE_CODE_AUTO_COMPACT_WINDOW: $compactWindow" "INFO"
Write-Log "MCP FreeLLMAPI registado: $(if ($mcpListResult -match 'freellmapi') {'sim'} {'nao (server disabled)'})" "INFO"
Write-Log "==========================================" "END"