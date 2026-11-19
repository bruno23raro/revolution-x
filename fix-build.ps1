# 1) .env.local integro (a chave estava com payload corrompido) + JWT_REFRESH_SECRET vazio
Copy-Item .env .env.local -Force
$refresh = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
if ((Get-Content .env -Raw) -notmatch 'JWT_REFRESH_SECRET') { Add-Content .env "JWT_REFRESH_SECRET=$refresh" }
Add-Content .env.local "JWT_REFRESH_SECRET=$refresh"
Select-String -Path .env.local -Pattern "SERVICE_ROLE" | ForEach-Object { $_.Line.Substring(0,70) }

# 2) output: standalone (idempotente)
$cfg = Get-Content next.config.mjs -Raw
if ($cfg -notmatch "standalone") {
  $cfg = [regex]::Replace($cfg, '(?m)^(\s*)const\s+(\w+)\s*=\s*\{', "`$1`n  output: 'standalone',", 1)
  Set-Content next.config.mjs $cfg -NoNewline
  Write-Host "PATCH next.config.mjs aplicado"
} else { Write-Host "OK next.config.mjs ja tem standalone" }

# 3) estaticos no runner (idempotente)
$df = Get-Content Dockerfile -Raw
if ($df -notmatch "\.next/static") {
  $df = $df -replace "(?m)^(COPY --from=build /app/\.next/standalone \.\/\r?$)", "`$1`r`nCOPY --from=build /app/.next/static ./.next/static"
  Set-Content Dockerfile $df -NoNewline
  Write-Host "PATCH Dockerfile aplicado"
} else { Write-Host "OK Dockerfile ja copia estaticos" }