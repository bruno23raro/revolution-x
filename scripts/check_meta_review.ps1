# check_meta_review.ps1 — Leitura APENAS de status do App Review
# Token lido de .env (ACCESS_TOKEN), não impresso.

$envContent = Get-Content .env -Raw
$match = [regex]::Match($envContent, 'ACCESS_TOKEN=([^\r\n]+)')
if (-not $match.Success) { Write-Error "ACCESS_TOKEN não encontrado em .env"; exit 1 }
$token = $match.Groups[1].Value

# 1) Review status do app principal
try {
  $review = Invoke-RestMethod -Uri "https://graph.facebook.com/v21.0/app/1112157761403064/review?access_token=$token" -Method Get
  $review | ConvertTo-Json -Depth 5
} catch {
  Write-Warning "Review endpoint falhou: $($_.Exception.Message)"
}

# 2) Permissions do app (quais scopes aprovados/solicitados)
try {
  $perms = Invoke-RestMethod -Uri "https://graph.facebook.com/v21.0/app/1112157761403064/permissions?access_token=$token" -Method Get
  $perms | ConvertTo-Json -Depth 5
} catch {
  Write-Warning "Permissions endpoint falhou: $($_.Exception.Message)"
}

# 3) Testar se ACCESS_TOKEN é system user válido (me/assigned_ad_accounts)
try {
  $me = Invoke-RestMethod -Uri "https://graph.facebook.com/v21.0/me?fields=id,name&access_token=$token" -Method Get
  $me | ConvertTo-Json -Depth 3
  $adAccounts = Invoke-RestMethod -Uri "https://graph.facebook.com/v21.0/me/assigned_ad_accounts?access_token=$token" -Method Get
  $adAccounts | ConvertTo-Json -Depth 3
} catch {
  Write-Warning "System user test falhou: $($_.Exception.Message)"
}