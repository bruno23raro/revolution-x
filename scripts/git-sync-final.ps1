# Script de sincronização final Revolution X
$ErrorActionPreference = 'Continue'
Set-Location 'c:\Users\Bruno\.claude\Revolution\X'

Write-Output "=== 1. GIT STATUS ==="
$status = git status --short
Write-Output "Arquivos pendentes: $($status.Count)"

Write-Output "`n=== 2. GIT ADD -A ==="
git add -A

Write-Output "`n=== 3. GIT STATUS APÓS ADD ==="
$statusAfter = git status --short
Write-Output "Arquivos staged: $($statusAfter.Count)"

Write-Output "`n=== 4. COMMIT ==="
git commit -m "feat: unificacao local-github-hosting - FASE 3.5 RLS hardening 64/64 tabelas + map frontend + migrations 025-029" 2>&1

Write-Output "`n=== 5. ULTIMOS COMMITS ==="
git log --oneline -5

Write-Output "`n=== 6. PUSH PARA MAIN ==="
$push = git push origin main 2>&1
Write-Output $push

Write-Output "`n=== 7. STATUS FINAL ==="
git status --short