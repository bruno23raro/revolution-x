# Script de Recuperação ENAMETOOLONG - Claude Code
# Execute no PowerShell como Administrador

# ============================================
# ESTADO ATUAL (medido em 2026-11-10)
# ============================================
# settings.local.json:    71,125 bytes, 636 permissões (EXCESSO)
# settings.local.optimized.json: 2,322 bytes, 52 permissões (OK)

# Limite Windows CreateProcessW: 32,767 caracteres

# ============================================
# RECUPERAÇÃO DEFINITIVA
# ============================================

Write-Host "========================================" -ForegroundColor Yellow
Write-Host " RECUPERAÇÃO AMBIENTE CLAUDE CODE" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$base = "C:\Users\Bruno\.claude\Revolution\X\.claude"
$original = "$base\settings.local.json"
$optimized = "$base\settings.local.optimized.json"
$backupDir = "$base\backups"

# Criar diretório de backups
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Write-Host "[✓] Diretório de backups criado" -ForegroundColor Green
}

# Backup do original
if (Test-Path $original) {
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupFile = "$base\settings.local.json.backup.$ts"
    Copy-Item $original $backupFile -Force
    Write-Host "[✓] Backup criado: $backupFile" -ForegroundColor Green
    Write-Host "    Tamanho original: 71,125 bytes (636 permissões)" -ForegroundColor Cyan
}

# Aplicar correção
if (Test-Path $optimized) {
    Copy-Item $optimized $original -Force
    Write-Host "[✓] Correção aplicada com sucesso" -ForegroundColor Green
    Write-Host "    Novo tamanho: 2,322 bytes (52 permissões)" -ForegroundColor Cyan
} else {
    Write-Host "[✗] ERRO: settings.local.optimized.json não encontrado" -ForegroundColor Red
    exit 1
}

# Validar JSON
try {
    $json = Get-Content $original | ConvertFrom-Json
    Write-Host "[✓] JSON validado: $($json.permissions.allow.Count) permissões" -ForegroundColor Green
} catch {
    Write-Host "[✗] JSON inválido: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "  REINICIAR CLAUDE DESKTOP" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "`nComandos para validação após reiniciar:" -ForegroundColor Gray
Write-Host "  node -v" -ForegroundColor Gray
Write-Host "  cd C:\Users\Bruno\.claude\Revolution\X" -ForegroundColor Gray
Write-Host "  npm run typecheck" -ForegroundColor Gray
Write-Host "  npm test" -ForegroundColor Gray
Write-Host "  npm run build" -ForegroundColor Gray