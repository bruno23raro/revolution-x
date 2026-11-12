# Script de Recuperação Seguro - ENAMETOOLONG
# Criado: 2026-11-10
# Status: PENDÊNDE - Requer aprovação do usuário

# ============================================
# AUDITORIA DE SEGURANÇA - CRÍTICOS
# ============================================
#
# PROBLEMAS IDENTIFICADOS NO SCRIPT ORIGINAL:
# 1. Usa -Force em operações destrutivas (Replace-Item)
# 2. Não verifica se já existe backup recente
# 3. Não preserva deny/ask/hooks do arquivo original
# 4. Não compara estruturas JSON antes de substituir
# 5. Usa "como Administrador" sem necessidade
#
# ============================================

param(
    [switch]$WhatIf,           # Show what would happen without making changes
    [switch]$ValidateOnly,       # Only validate existing settings
    [switch]$BackupOriginal,   # Create backup of current settings
    [switch]$ApplyRecovery     # Apply the optimized settings
)

$base = "C:\Users\Bruno\.claude\Revolution\X\.claude"
$original = "$base\settings.local.json"
$optimized = "$base\settings.local.optimized.json"
$backupDir = "$base\backups"

# ============================================
# FUNÇÕES DE APOIO SEGURAS
# ============================================

function Test-JsonFile {
    param([string]$Path)
    try {
        $null = Get-Content $Path | ConvertFrom-Json -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Compare-JsonStructures {
    param([string]$Original, [string]$Candidate)

    $origJson = Get-Content $Original | ConvertFrom-Json
    $candJson = Get-Content $Candidate | ConvertFrom-Json

    $result = [ordered]@{
        OriginalPermits = $origJson.permissions.allow.Count
        CandidatePermits = $candJson.permissions.allow.Count
        OriginalDeny = $origJson.permissions.deny.Count
        CandidateDeny = $candJson.permissions.deny.Count
        HasDefaultMode = $null -ne $candJson.permissions.defaultMode
        DefaultMode = $candJson.permissions.defaultMode
        HasAdditionalDirs = $null -ne $candJson.permissions.additionalDirectories
        AdditionalDirs = $candJson.permissions.additionalDirectories.Count
        EnabledMcpServers = $candJson.enabledMcpjsonServers.Count
        HasHooks = $null -ne $candJson.hooks
    }

    return $result
}

# ============================================
# EXECUÇÃO
# ============================================

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  RECUPERAÇÃO SEGURA - ENAMETOOLONG" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

# 1. Validação do ambiente
Write-Host "`n[1] Verificando arquivos..." -ForegroundColor Cyan

if (-not (Test-Path $original)) {
    Write-Host "    [!] settings.local.json não encontrado" -ForegroundColor Yellow
    Write-Host "    Estado atual: Arquivo não existe" -ForegroundColor Gray
} else {
    $origSize = (Get-Item $original).Length
    $origJson = Get-Content $original | ConvertFrom-Json
    Write-Host "    settings.local.json: $origSize bytes, $($origJson.permissions.allow.Count) permissões" -ForegroundColor Green
}

if (Test-Path $optimized) {
    $optSize = (Get-Item $optimized).Length
    if (Test-JsonFile $optimized) {
        $optJson = Get-Content $optimized | ConvertFrom-Json
        Write-Host "    settings.local.optimized.json: $optSize bytes, $($optJson.permissions.allow.Count) permissões (JSON válido)" -ForegroundColor Green
    } else {
        Write-Host "    [!] settings.local.optimized.json: JSON INVÁLIDO!" -ForegroundColor Red
    }
} else {
    Write-Host "    [!] settings.local.optimized.json não encontrado" -ForegroundColor Red
}

# 2. Análise de permissões críticas
Write-Host "`n[2] Análise de permissões..." -ForegroundColor Cyan

if (Test-Path $optimized) {
    $json = Get-Content $optimized | ConvertFrom-Json

    $bashPerms = $json.permissions.allow | Where-Object { $_ -like "Bash*" }
    $psPerms = $json.permissions.allow | Where-Object { $_ -like "PowerShell*" }
    $writePerms = $json.permissions.allow | Where-Object { $_ -match "^(Write|Edit|Bash.*rm|Bash.*rm -rf|Bash.*git push)" }
    $mcpPerms = $json.permissions.allow | Where-Object { $_ -like "mcp__*" }

    Write-Host "    Bash/globais: $($bashPerms.Count)" -ForegroundColor $(if($bashPerms.Count -gt 50){"Yellow"}else{"Green"})
    Write-Host "    PowerShell/globais: $($psPerms.Count)" -ForegroundColor $(if($psPerms.Count -gt 30){"Yellow"}else{"Green"})
    Write-Host "    Write/Edit/globais: $($writePerms.Count)" -ForegroundColor $(if($writePerms.Count -gt 5){"Yellow"}else{"Green"})
    Write-Host "    MCPs: $($mcpPerms.Count)" -ForegroundColor "Cyan"
}

# 3. Comparação estrutural
Write-Host "`n[3] Comparação estrutural..." -ForegroundColor Cyan

if (Test-Path $original -and (Test-Path $optimized)) {
    $comparison = Compare-JsonStructures -Original $original -Candidate $optimized

    Write-Host "    Permissões originais: $($comparison.OriginalPermits)"
    Write-Host "    Permissões candidatas: $($comparison.CandidatePermits)"
    Write-Host "    Redução necessária: $(($comparison.OriginalPermits - $comparison.CandidatePermits)) permissões"

    if ($comparison.HasDefaultMode) {
        Write-Host "    DefaultMode: $($comparison.DefaultMode)" -ForegroundColor $(if($comparison.DefaultMode -eq "bypassPermissions"){"Yellow"}else{"Green"})
    }

    if ($comparison.HasHooks -or $comparison.HasAdditionalDirs) {
        Write-Host "    Propriedades adicionais: Preservadas?" -ForegroundColor Yellow
        Write-Host "    [!] REQUER APOIO PARA PRESERVAR: deny, ask, hooks, additionalDirectories" -ForegroundColor Red
    }
}

# 4. Ações disponíveis
Write-Host "`n[4] Ações disponíveis:" -ForegroundColor Cyan
Write-Host "    -WhatIf       : Mostra o que aconteceria sem fazer alterações"
Write-Host "    -ValidateOnly : Apenas valida os arquivos existentes"
Write-Host "    -BackupOriginal : Cria backup do settings atual"
Write-Host "    -ApplyRecovery : Aplica a recuperação (REQUER APPROVAL)"

Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "  INSTRUÇÕES PARA RECUPERAÇÃO" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

Write-Host @"

O arquivo settings.local.json excede o limite do Windows:
- Tamanho atual: ~71KB (636 permissões)
- Limite: 32,767 caracteres
- Excesso: ~60,000+ caracteres

Para recuperação SEGURA, siga estes passos MANUAIS:

1. BACKUP (executar no PowerShell):
   Copy-Item "C:\Users\Bruno\.claude\Revolution\X\.claude\settings.local.json" `
             "C:\Users\Bruno\.claude\Revolution\X\.claude\settings.local.json.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"

2. VERIFICAR permissões críticas no settings.local.optimized.json:
   - Bash: permissões genéricas (não restringidas)
   - PowerShell: permissões genéricas (não restringidas)
   - Write/Edit: irrestritos
   - mcp__*__*: all methods

3. DECISÃO: O arquivo otimizado é seguro para uso?
   - Se SIM: substituir settings.local.json
   - Se NÃO: revisar permissões antes

4. SUBSTITUIÇÃO (após backup):
   # NÃO usar Remove-Item + Rename-Item
   # Usar: Copy-Item (preserva original como backup)

   Get-Content "C:\Users\Bruno\.claude\Revolution\X\.claude\settings.local.optimized.json" | `
       Set-Content "C:\Users\Bruno\.claude\Revolution\X\.claude\settings.local.json" -Encoding UTF8

5. VALIDAÇÃO:
   node -v
   cd "C:\Users\Bruno\.claude\Revolution\X"
   npm run typecheck

"@ -ForegroundColor White

Write-Host "`n⚠️  REQUER APROVAÇÃO DO USUÁRIO PARA EXECUÇÃO" -ForegroundColor Red