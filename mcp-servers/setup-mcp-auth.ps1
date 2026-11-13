# ============================================================================
# Script de Configuração de MCP Auth - Revolution X
# ============================================================================
# Este script facilita a configuração de Tokens de Autenticação
# para os servidores MCP GitHub e Vercel.
#
# Uso:
# .\setup-mcp-auth.ps1
#
# Ou passar tokens como argumentos:
# .\setup-mcp-auth.ps1 -GitHubToken "seu_token" -VercelToken "seu_token"
# ============================================================================

param(
    [string]$GitHubToken = "",
    [string]$VercelToken = ""
)

$mcpJsonPath = "C:\Users\Bruno\.claude\Revolution\X\.mcp.json"

# Função para backup
function Backup-McpJson {
    $backupPath = $mcpJsonPath + ".backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
    Copy-Item $mcpJsonPath $backupPath
    Write-Host "✅ Backup criado: $backupPath"
}

# Função para atualizar GitHub token
function Update-GitHubToken {
    param([string]$token)

    $content = Get-Content $mcpJsonPath -Raw | ConvertFrom-Json

    # Atualizar token no GitHub original
    if ($content.mcpServers.github.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
        $content.mcpServers.github.env.GITHUB_PERSONAL_ACCESS_TOKEN = $token
    }

    # Atualizar token no GitHub custom
    if ($content.mcpServers.'github-custom'.env.GITHUB_TOKEN) {
        $content.mcpServers.'github-custom'.env.GITHUB_TOKEN = $token
    }

    $content | ConvertTo-Json -Depth 10 | Set-Content $mcpJsonPath -Encoding utf8
    Write-Host "✅ Token GitHub atualizado"
}

# Função para atualizar Vercel token
function Update-VercelToken {
    param([string]$token)

    $content = Get-Content $mcpJsonPath -Raw | ConvertFrom-Json

    if ($content.mcpServers.'vercel-custom'.env.VERCEL_TOKEN) {
        $content.mcpServers.'vercel-custom'.env.VERCEL_TOKEN = $token
    }

    $content | ConvertTo-Json -Depth 10 | Set-Content $mcpJsonPath -Encoding utf8
    Write-Host "✅ Token Vercel atualizado"
}

# Função para verificar se tokens são válidos
function Test-Token {
    param([string]$token, [string]$service)

    if ([string]::IsNullOrEmpty($token)) {
        Write-Host "⚠️ Token $service não fornecido"
        return $false
    }

    Write-Host "✅ Token $service configurado"
    return $true
}

# === EXECUÇÃO ===

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuração de MCP Auth - Revolution X" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Fazer backup
Backup-McpJson

# Obter tokens se não fornecidos
if ([string]::IsNullOrEmpty($GitHubToken)) {
    Write-Host "`n🔐 Configuração do GitHub Personal Access Token" -ForegroundColor Yellow
    Write-Host "Dica: Crie um token em https://github.com/settings/tokens" -ForegroundColor Gray
    $GitHubToken = Read-Host "Digite seu GitHub PAT"
}

if ([string]::IsNullOrEmpty($VercelToken)) {
    Write-Host "`n🔐 Configuração do Vercel Token" -ForegroundColor Yellow
    Write-Host "Dica: Crie um token em https://vercel.com/account/tokens" -ForegroundColor Gray
    $VercelToken = Read-Host "Digite seu Vercel Token"
}

# Validar tokens
$githubValid = Test-Token -token $GitHubToken -service "GitHub"
$vercelValid = Test-Token -token $VercelToken -service "Vercel"

# Atualizar tokens
if ($githubValid) {
    Update-GitHubToken -token $GitHubToken
}

if ($vercelValid) {
    Update-VercelToken -token $VercelToken
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✅ Configuração concluída!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Mostrar ferramentas MCP disponíveis
Write-Host "`nMCPs configurados:" -ForegroundColor Cyan
Write-Host "  - github (oficial): Lists, PRs, Issues, Commits..."
Write-Host "  - github-custom: Ferramentas estendidas para autenticação"
Write-Host "  - vercel-custom: Projetos, deployments, domínios, env vars"
Write-Host "`nPressione Enter para reiniciar o MCP..." -ForegroundColor Gray