param([switch]$Masked)

$files = @(".env", ".env.local", ".env.production", ".env.development") | Where-Object { Test-Path $_ }
if (-not $files) { "nenhum .env encontrado"; exit 1 }

function Show([string]$v, [switch]$m) {
  if (-not $m) { return $v }
  if ($v.Length -le 12) { return ("*" * $v.Length) }
  return $v.Substring(0, 6) + ("*" * 8) + $v.Substring($v.Length - 4)
}

foreach ($f in $files) {
  ""
  "== $f"
  $i = 0
  foreach ($line in Get-Content $f) {
    $i++
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { continue }
    $k, $v = $line.Split("=", 2)
    $vl = $v.Trim().Trim('"').Trim("'")
    if (-not $vl) { "  {0,-42} FALTANDO (linha {1})" -f $k.Trim(), $i; continue }
    if ($vl -match "^(changeme|xxx|seu_|your_|todo|placeholder)" -or $vl -match "[<>]") {
      "  {0,-42} PLACEHOLDER '{1}' (linha {2})" -f $k.Trim(), $vl, $i; continue
    }
    "  {0,-42} {1} (linha {2})" -f $k.Trim(), (Show $vl -m:$Masked), $i
  }
}

""
"== MCP (.mcp.json / .claude.json)"
foreach ($j in @(".mcp.json", "$env:USERPROFILE\.claude.json")) {
  if (-not (Test-Path $j)) { "  $j ausente"; continue }
  try { $d = Get-Content $j -Raw | ConvertFrom-Json } catch { "  $j JSON invalido"; continue }
  $servers = $d.mcpServers; if (-not $servers) { $servers = $d.servers }
  if (-not $servers) { "  $j sem servidores"; continue }
  foreach ($p in $servers.PSObject.Properties) {
    foreach ($e in @($p.Value.env, $p.Value.headers)) {
      if (-not $e) { continue }
      foreach ($h in $e.PSObject.Properties) {
        "  {0} :: {1} = {2}" -f $p.Name, $h.Name, (Show ([string]$h.Value) -m:$Masked)
      }
    }
  }
}