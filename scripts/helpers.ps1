function Merge-JsonFile {
    param([string]$Path, [hashtable]$Data)
    $dir = Split-Path $Path -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    if (Test-Path $Path) { Copy-Item $Path "$Path.bak" -Force }
    $obj = if (Test-Path $Path) { Get-Content $Path -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
    $map = @{}; if ($obj) { $obj.PSObject.Properties | ForEach-Object { $map[$_.Name] = $_.Value } }
    foreach ($k in $Data.Keys) {
        if (-not $map.ContainsKey($k)) { $map[$k] = $Data[$k] }
        elseif ($map[$k] -is [pscustomobject] -and $Data[$k] -is [hashtable]) {
            $inner = @{}; $map[$k].PSObject.Properties | ForEach-Object { $inner[$_.Name] = $_.Value }
            foreach ($ik in $Data[$k].Keys) { if (-not $inner.ContainsKey($ik)) { $inner[$ik] = $Data[$k][$ik] } }
            $map[$k] = [pscustomobject]$inner
        }
    }
    $map | ConvertTo-Json -Depth 20 | Set-Content $Path -Encoding utf8
}
function Add-LinesIfMissing {
    param([string]$Path, [string[]]$Lines)
    $existing = if (Test-Path $Path) { Get-Content $Path -Raw } else { '' }
    $add = @(); foreach ($l in $Lines) { if ($existing -notmatch [regex]::Escape($l)) { $add += $l } }
    if ($add.Count -gt 0) { Add-Content -Path $Path -Value ($add -join "`r`n") -Encoding utf8 }
}
function Add-EnvVar {
    param([string]$Name, [string]$Value, [string]$File = '.env')
    if (-not (Test-Path $File)) { New-Item -ItemType File -Path $File | Out-Null }
    if ((Get-Content $File -Raw) -notmatch "(?m)^$([regex]::Escape($Name))=") { Add-Content $File "`r`n$Name=$Value" -Encoding utf8 }
}
function Set-McpServer {
    param([Parameter(Mandatory)][string]$Name,[Parameter(Mandatory)][string]$Command,[string[]]$Args,[hashtable]$Env)
    $P = (Get-Location).Path; $f = Join-Path $P '.mcp.json'
    if (Test-Path $f) { Copy-Item $f "$f.bak" -Force; $j = Get-Content $f -Raw | ConvertFrom-Json } else { $j = [pscustomobject]@{} }
    if (-not $j.PSObject.Properties['mcpServers']) { $j | Add-Member -NotePropertyName mcpServers -NotePropertyValue ([pscustomobject]@{}) }
    $srv = [ordered]@{ command = $Command }
    if ($Args) { $srv['args'] = $Args }; if ($Env) { $srv['env'] = $Env }
    if ($j.mcpServers.PSObject.Properties[$Name]) { $j.mcpServers.$Name = [pscustomobject]$srv }
    else { $j.mcpServers | Add-Member -NotePropertyName $Name -NotePropertyValue ([pscustomobject]$srv) }
    $j | ConvertTo-Json -Depth 30 | Set-Content $f -Encoding utf8
    Write-Host "MCP '$Name' gravado." -ForegroundColor Green
}
function New-FileIfMissing {
    param([string]$Path,[string]$Content = '')
    if (Test-Path $Path) { Write-Host "existe: $Path" -ForegroundColor DarkGray; return }
    $d = Split-Path $Path -Parent
    if ($d -and -not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
    Set-Content -Path $Path -Value $Content -Encoding utf8; Write-Host "criado: $Path" -ForegroundColor Green
}
function New-DirIfMissing { param([string]$Path) if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null; Write-Host "criado: $Path" -ForegroundColor Green } }
function Invoke-AuthGate {
    param([string]$Tool,[string]$Url,[string]$Hint)
    Write-Host "`n=== AUTENTICACAO: $Tool ===" -ForegroundColor Cyan; Write-Host $Hint
    if ($Url) { Start-Process $Url; Write-Host $Url -ForegroundColor DarkGray }
    do { $r = Read-Host "ENTER = concluido | s = pular" } while ($r -eq '')
    if ($r -eq 's') { return $false }; return $true
}
function Set-ProjectAuthEnv {
    $P = (Get-Location).Path
    $env:GH_CONFIG_DIR = Join-Path $P '.auth\gh'
    $env:VERCEL_CONFIG_DIR = Join-Path $P '.auth\vercel'
    $env:SUPABASE_HOME = Join-Path $P '.auth\supabase'
    $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $P '.auth\playwright'
    Write-Host "Auth isolada no projeto." -ForegroundColor Green
}

function Set-EnvVar {
    param([string]$Name,[string]$Value,[string]$File = '.env')
    if (-not (Test-Path $File)) { New-Item -ItemType File $File | Out-Null }
    $raw = if (Test-Path $File) { Get-Content $File -Raw } else { '' }
    if ($raw -match "(?m)^$([regex]::Escape($Name))=") {
        Copy-Item $File "$File.bak" -Force
        ($raw -replace "(?m)^$([regex]::Escape($Name))=.*$", "$Name=$Value") | Set-Content $File -Encoding utf8
    } else { Add-Content $File "`r`n$Name=$Value" -Encoding utf8 }
}

function Set-TextBlock {
    param([string]$Path,[string]$Marker,[string]$Content)
    New-FileIfMissing -Path $Path
    $raw = Get-Content $Path -Raw
    $pattern = "(?s)#>>> $([regex]::Escape($Marker)).*?#<<< $([regex]::Escape($Marker))"
    $block = "#>>> $Marker`r`n$Content`r`n#<<< $Marker"
    if ($raw -match $pattern) {
        Copy-Item $Path "$Path.bak" -Force
        ($raw -replace $pattern, $block) | Set-Content $Path -Encoding utf8
    } else {
        Add-Content $Path "`r`n$block" -Encoding utf8
    }
    Write-Host "bloco '$Marker' aplicado em $Path" -ForegroundColor Green
}
