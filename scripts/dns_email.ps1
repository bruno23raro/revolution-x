# DNS do dominio de e-mail, via DoH do Cloudflare (nao depende do resolver local)
function Get-TxtDoh([string]$name) {
  try {
    $r = Invoke-RestMethod -Uri "https://cloudflare-dns.com/dns-query?name=$name&type=TXT" -Headers @{ Accept = 'application/dns-json' }
    if (-not $r.Answer) { return @() }
    return @($r.Answer | ForEach-Object { $_.data -replace '"', '' })
  } catch { return @("ERRO $($_.Exception.Message)") }
}

$names = @(
  'revolutionx.com.br',                       # SPF / DMARC no apex
  'send.revolutionx.com.br',                  # SPF do subdominio de envio Resend
  'resend._domainkey.revolutionx.com.br',     # DKIM Resend
  'send._domainkey.revolutionx.com.br',
  '_dmarc.revolutionx.com.br'
)
foreach ($n in $names) {
  $t = Get-TxtDoh $n
  if ($t.Count -eq 0) { Write-Output "TXT $n : (nenhum registro)" }
  else { foreach ($v in $t) { Write-Output "TXT $n : $v" } }
}
