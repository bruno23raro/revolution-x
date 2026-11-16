# Revolution X — inventario seguro e staging local para Claude Code/Codex
# Windows PowerShell 5.1+ ou PowerShell 7+. Executar como usuario normal, nao como Administrador.
# Nao instala, move, apaga, altera Git, le conteudo de .env, copia MCP, plugins,
# extensoes, executaveis, perfis/cookies de navegador ou dependencias do projeto.

$ErrorActionPreference = 'Stop'
$ProjectPath = 'C:\Users\Bruno\.claude\Revolution\X'

if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {
    throw "Pasta nao encontrada: $ProjectPath. Corrija ProjectPath no inicio do script e rode novamente."
}
$ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path.TrimEnd('\')
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$AuditRoot = Join-Path (Join-Path $env:USERPROFILE 'Documents') "RevolutionX-Local-Audit-$Stamp"
$StageRoot = Join-Path $AuditRoot 'portable-agent-reference'
New-Item -ItemType Directory -Path $AuditRoot -Force | Out-Null
New-Item -ItemType Directory -Path $StageRoot -Force | Out-Null

# Dependencias, builds, caches, dados e perfis: nao varrer recursivamente.
$SkipDirNames = @(
    '.git', 'node_modules', '.next', '.vercel', '.turbo', '.cache', '.pnpm-store', '.yarn',
    'dist', 'build', 'out', 'coverage', 'vendor', 'target', '.venv', 'venv', '__pycache__',
    '.pytest_cache', '.auth', 'worktrees', 'browser-data', 'browser-profile', 'chrome-profile',
    'profiles', 'storage', 'uploads', 'logs', 'tmp', 'temp', 'postgres-data', 'redis-data'
)
# So nomes/metadados sao inventariados. Arquivos sensiveis e binarios ficam fora do CSV.
$SensitiveNamePattern = '(?i)(^\.env($|\.)|credentials?|secrets?|password|cookies?|session|id_rsa|id_ed25519|\.(pem|key|p12|pfx|keystore|kdbx|sqlite\d*|db|bak|backup|zip|7z|rar|crx|vsix|exe|dll|msi)$)'
$Inventory = New-Object 'System.Collections.Generic.List[object]'
$SkippedDirs = New-Object 'System.Collections.Generic.List[object]'
$SkippedFiles = New-Object 'System.Collections.Generic.List[object]'
$ScanErrors = New-Object 'System.Collections.Generic.List[string]'
$Stack = New-Object 'System.Collections.Generic.Stack[string]'
$Stack.Push($ProjectPath)

while ($Stack.Count -gt 0) {
    $CurrentDir = $Stack.Pop()
    try {
        $Children = Get-ChildItem -LiteralPath $CurrentDir -Force -ErrorAction Stop
    } catch {
        [void]$ScanErrors.Add("$CurrentDir | $($_.Exception.Message)")
        continue
    }

    foreach ($Item in $Children) {
        if ($Item.PSIsContainer) {
            if ($SkipDirNames -contains $Item.Name) {
                [void]$SkippedDirs.Add([pscustomobject]@{ Path = $Item.FullName; Reason = 'pasta pesada/sensivel excluida' })
                continue
            }
            if (($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                [void]$SkippedDirs.Add([pscustomobject]@{ Path = $Item.FullName; Reason = 'link/reparse point nao seguido' })
                continue
            }
            $Stack.Push($Item.FullName)
            continue
        }

        if ($Item.Name -match $SensitiveNamePattern) {
            [void]$SkippedFiles.Add([pscustomobject]@{ Path = $Item.FullName; Reason = 'nome sensivel/binario; conteudo nao lido' })
            continue
        }

        $RelativePath = $Item.FullName.Substring($ProjectPath.Length).TrimStart('\')
        [void]$Inventory.Add([pscustomobject]@{
            RelativePath = $RelativePath
            Extension = $Item.Extension
            Bytes = $Item.Length
            LastWriteTime = $Item.LastWriteTime.ToString('s')
        })
    }
}

$Inventory | Sort-Object RelativePath | Export-Csv -LiteralPath (Join-Path $AuditRoot 'project-inventory.csv') -NoTypeInformation -Encoding UTF8
$SkippedDirs | Export-Csv -LiteralPath (Join-Path $AuditRoot 'excluded-directories.csv') -NoTypeInformation -Encoding UTF8
$SkippedFiles | Export-Csv -LiteralPath (Join-Path $AuditRoot 'excluded-sensitive-filenames.csv') -NoTypeInformation -Encoding UTF8
$ScanErrors | Set-Content -LiteralPath (Join-Path $AuditRoot 'scan-errors.txt') -Encoding UTF8

# Registrar ferramentas instaladas somente por nome, caminho e versao; nao instalar nada.
$ToolNames = @('claude', 'codex', 'code', 'git', 'node', 'npm', 'pnpm', 'docker', 'wsl', 'python', 'py')
$ToolRows = foreach ($ToolName in $ToolNames) {
    $Command = Get-Command -Name $ToolName -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $Command) {
        [pscustomobject]@{ Tool = $ToolName; Found = $false; Path = ''; Version = '' }
    } else {
        $VersionText = ''
        try {
            $VersionOutput = & $Command.Source --version 2>&1
            $VersionText = (($VersionOutput | Select-Object -First 1) -join '').ToString()
        } catch {
            $VersionText = 'versao nao consultavel por este comando'
        }
        [pscustomobject]@{ Tool = $ToolName; Found = $true; Path = $Command.Source; Version = $VersionText }
    }
}
$ToolRows | Export-Csv -LiteralPath (Join-Path $AuditRoot 'tool-inventory.csv') -NoTypeInformation -Encoding UTF8

# Listar IDs de extensoes do VS Code (nao copiar nem instalar os pacotes).
$CodeCommand = Get-Command -Name 'code' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -ne $CodeCommand) {
    try {
        & $CodeCommand.Source --list-extensions --show-versions 2>&1 |
            Set-Content -LiteralPath (Join-Path $AuditRoot 'vscode-extensions.txt') -Encoding UTF8
    } catch {
        "Falha ao listar extensoes: $($_.Exception.Message)" |
            Set-Content -LiteralPath (Join-Path $AuditRoot 'vscode-extensions.txt') -Encoding UTF8
    }
} else {
    'Comando code nao encontrado no PATH.' |
        Set-Content -LiteralPath (Join-Path $AuditRoot 'vscode-extensions.txt') -Encoding UTF8
}

# Registrar somente existencia/localizacao de configuracoes conhecidas; nunca ler seu conteudo.
$ConfigPaths = @(
    [pscustomobject]@{ Scope = 'Projeto'; Path = (Join-Path $ProjectPath 'CLAUDE.md') },
    [pscustomobject]@{ Scope = 'Projeto'; Path = (Join-Path $ProjectPath 'AGENTS.md') },
    [pscustomobject]@{ Scope = 'Projeto'; Path = (Join-Path $ProjectPath '.mcp.json') },
    [pscustomobject]@{ Scope = 'Projeto'; Path = (Join-Path $ProjectPath '.claude\settings.json') },
    [pscustomobject]@{ Scope = 'Projeto'; Path = (Join-Path $ProjectPath '.claude\settings.local.json') },
    [pscustomobject]@{ Scope = 'Projeto'; Path = (Join-Path $ProjectPath '.claude\skills') },
    [pscustomobject]@{ Scope = 'Projeto'; Path = (Join-Path $ProjectPath '.claude\agents') },
    [pscustomobject]@{ Scope = 'Projeto'; Path = (Join-Path $ProjectPath '.agents\skills') },
    [pscustomobject]@{ Scope = 'Projeto'; Path = (Join-Path $ProjectPath '.codex\config.toml') },
    [pscustomobject]@{ Scope = 'Projeto'; Path = (Join-Path $ProjectPath '.vscode\mcp.json') },
    [pscustomobject]@{ Scope = 'Usuario Claude'; Path = (Join-Path $env:USERPROFILE '.claude.json') },
    [pscustomobject]@{ Scope = 'Usuario Claude'; Path = (Join-Path $env:USERPROFILE '.claude\settings.json') },
    [pscustomobject]@{ Scope = 'Usuario Claude'; Path = (Join-Path $env:USERPROFILE '.claude\skills') },
    [pscustomobject]@{ Scope = 'Usuario Claude'; Path = (Join-Path $env:USERPROFILE '.claude\agents') },
    [pscustomobject]@{ Scope = 'Usuario Codex'; Path = (Join-Path $env:USERPROFILE '.codex\config.toml') },
    [pscustomobject]@{ Scope = 'Usuario Codex'; Path = (Join-Path $env:USERPROFILE '.codex\AGENTS.md') },
    [pscustomobject]@{ Scope = 'Usuario Codex'; Path = (Join-Path $env:USERPROFILE '.agents\skills') }
)
$ConfigRows = foreach ($Entry in $ConfigPaths) {
    [pscustomobject]@{ Scope = $Entry.Scope; Exists = (Test-Path -LiteralPath $Entry.Path); Path = $Entry.Path }
}
$ConfigRows | Export-Csv -LiteralPath (Join-Path $AuditRoot 'configuration-presence-only.csv') -NoTypeInformation -Encoding UTF8

# Copiar apenas documentacao portavel de skills/agentes para area fora do repositorio.
# Scripts, JSON de MCP, settings, binarios, cookies, tokens e segredos nao sao copiados.
$SourceRoots = @(
    [pscustomobject]@{ Name = 'claude-project-skills'; Path = (Join-Path $ProjectPath '.claude\skills'); Target = 'claude-project\.claude\skills' },
    [pscustomobject]@{ Name = 'claude-project-agents'; Path = (Join-Path $ProjectPath '.claude\agents'); Target = 'claude-project\.claude\agents' },
    [pscustomobject]@{ Name = 'claude-project-commands'; Path = (Join-Path $ProjectPath '.claude\commands'); Target = 'claude-project\.claude\commands' },
    [pscustomobject]@{ Name = 'codex-project-skills'; Path = (Join-Path $ProjectPath '.agents\skills'); Target = 'codex-project\.agents\skills' },
    [pscustomobject]@{ Name = 'claude-user-skills'; Path = (Join-Path $env:USERPROFILE '.claude\skills'); Target = 'claude-user\.claude\skills' },
    [pscustomobject]@{ Name = 'claude-user-agents'; Path = (Join-Path $env:USERPROFILE '.claude\agents'); Target = 'claude-user\.claude\agents' },
    [pscustomobject]@{ Name = 'codex-user-skills'; Path = (Join-Path $env:USERPROFILE '.agents\skills'); Target = 'codex-user\.agents\skills' }
)
$AllowedDocExtensions = @('.md', '.txt', '.yaml', '.yml')
$StagedRows = New-Object 'System.Collections.Generic.List[object]'
$StagingSkipPattern = '(?i)(^\.env|secret|credential|password|cookie|session|token|\.(pem|key|p12|pfx|kdbx)$)'

foreach ($Source in $SourceRoots) {
    if (-not (Test-Path -LiteralPath $Source.Path -PathType Container)) { continue }
    $DestinationRoot = Join-Path $StageRoot $Source.Target
    $Files = Get-ChildItem -LiteralPath $Source.Path -File -Recurse -Force -ErrorAction SilentlyContinue
    foreach ($File in $Files) {
        if ($AllowedDocExtensions -notcontains $File.Extension.ToLowerInvariant()) { continue }
        if ($File.Name -match $StagingSkipPattern) { continue }
        if ($File.Length -gt 2MB) { continue }
        $Relative = $File.FullName.Substring($Source.Path.TrimEnd('\').Length).TrimStart('\')
        $Destination = Join-Path $DestinationRoot $Relative
        $DestinationDirectory = Split-Path -Parent $Destination
        New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
        Copy-Item -LiteralPath $File.FullName -Destination $Destination
        [void]$StagedRows.Add([pscustomobject]@{ Source = $File.FullName; StagedCopy = $Destination; Bytes = $File.Length })
    }
}
$StagedRows | Export-Csv -LiteralPath (Join-Path $AuditRoot 'staged-documentation.csv') -NoTypeInformation -Encoding UTF8

# Estado do Git somente local; nao imprimir URLs de remotes nem conteudo de arquivos.
$GitCommand = Get-Command -Name 'git' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -ne $GitCommand) {
    try {
        & $GitCommand.Source -C $ProjectPath status --short --branch 2>&1 |
            Set-Content -LiteralPath (Join-Path $AuditRoot 'git-status.txt') -Encoding UTF8
        & $GitCommand.Source -C $ProjectPath rev-parse --show-toplevel 2>&1 |
            Set-Content -LiteralPath (Join-Path $AuditRoot 'git-root.txt') -Encoding UTF8
    } catch {
        "Falha ao consultar Git: $($_.Exception.Message)" |
            Set-Content -LiteralPath (Join-Path $AuditRoot 'git-status.txt') -Encoding UTF8
    }
} else {
    'Git nao encontrado no PATH.' | Set-Content -LiteralPath (Join-Path $AuditRoot 'git-status.txt') -Encoding UTF8
}

$Summary = @"
REVOLUTION X — INVENTARIO LOCAL NAO DESTRUTIVO
Projeto: $ProjectPath
Auditoria: $AuditRoot
Arquivos inventariados (somente metadados): $($Inventory.Count)
Pastas excluidas: $($SkippedDirs.Count)
Nomes de arquivos sensiveis/binarios omitidos: $($SkippedFiles.Count)
Erros de leitura de metadados: $($ScanErrors.Count)
Documentos portaveis copiados para staging externo: $($StagedRows.Count)

Nenhum arquivo foi apagado ou movido. Nenhum .env, cookie, perfil de navegador, config MCP,
plugin, extensao, executavel, dependencia ou arquivo de banco foi copiado ou aberto.
As copias staged sao apenas documentos Markdown/TXT/YAML pequenos e ficam fora do repositorio.
Revise-as localmente antes de instalar/ativar qualquer skill ou agente.
Nao envie esta pasta de auditoria a terceiros: um documento pode conter texto sensivel escrito manualmente.

Arquivos principais: project-inventory.csv, excluded-directories.csv,
excluded-sensitive-filenames.csv, tool-inventory.csv, vscode-extensions.txt,
configuration-presence-only.csv, staged-documentation.csv, git-status.txt.
"@
$Summary | Set-Content -LiteralPath (Join-Path $AuditRoot 'LEIA-ME.txt') -Encoding UTF8

Write-Host ''
Write-Host 'Preparacao concluida. Nenhum arquivo do projeto foi movido, apagado ou modificado.' -ForegroundColor Green
Write-Host "Projeto: $ProjectPath"
Write-Host "Relatorios e staging fora do deploy: $AuditRoot"
Write-Host "Copias de documentos portaveis: $StageRoot"
Write-Host "Arquivos inventariados: $($Inventory.Count); documentos staged: $($StagedRows.Count); erros: $($ScanErrors.Count)"
Write-Host 'Revise LEIA-ME.txt. Nao compartilhe configuracoes, cookies, tokens ou o staging sem revisar.'
