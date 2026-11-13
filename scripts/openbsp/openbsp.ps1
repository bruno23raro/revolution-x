# openbsp.ps1 — CLI local para OpenBSP (PostgREST)
# Uso:
#   openbsp config set --url URL --apikey PUB --apikey-secret SECRET --org ORG_ID
#   openbsp accounts
#   openbsp conversations [--limit 20]
#   openbsp messages --conversation PHONE [--limit 30]
#   openbsp send --to PHONE --text "ola"
#   openbsp contacts [--search nome]
#   openbsp query GET "/rest/v1/contacts?select=*&limit=5"
#   openbsp query POST "/rest/v1/messages" --body '{"organization_id":"...","..."}'

param(
    [Parameter(Position=0)][string]$Command = "help",
    [string]$Url,
    [string]$Apikey,
    [string]$ApikeySecret,
    [string]$Org,
    [string]$To,
    [string]$Text,
    [string]$Conversation,
    [string]$Search,
    [string]$Body,
    [int]$Limit = 20,
    [Parameter(ValueFromRemainingArguments=$true)][string[]]$Rest
)

$ConfigPath = Join-Path $env:USERPROFILE ".openbsp\config.json"

function Get-Config {
    if (-not (Test-Path $ConfigPath)) {
        throw "Config ausente. Rode: openbsp config set --url ... --apikey ... --apikey-secret ... --org ..."
    }
    Get-Content $ConfigPath -Raw | ConvertFrom-Json
}

function Save-Config($obj) {
    $dir = Split-Path $ConfigPath
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $obj | ConvertTo-Json | Set-Content $ConfigPath -Encoding UTF8
}

function Invoke-OpenBsp {
    param([string]$Method, [string]$Path, [string]$JsonBody)
    $c = Get-Config
    $uri = ($c.url.TrimEnd('/') + $Path)
    $headers = @{
        "apikey"        = $c.apikey
        "api-key"       = $c.apikeySecret
        "Content-Type"  = "application/json"
        "Prefer"        = "return=representation"
    }
    $params = @{
        Method  = $Method
        Uri     = $uri
        Headers = $headers
    }
    if ($JsonBody) { $params.Body = $JsonBody }
    try {
        $r = Invoke-RestMethod @params
        $r | ConvertTo-Json -Depth 20
    } catch {
        Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
        exit 1
    }
}

switch ($Command.ToLower()) {
    "help" {
        @"
openbsp CLI — OpenBSP WhatsApp/Instagram API

  openbsp config set --url <SUPABASE_URL> --apikey <PUBLISHABLE> --apikey-secret <API_KEY> --org <ORG_ID>
  openbsp config show
  openbsp accounts
  openbsp conversations [--limit 20]
  openbsp messages --conversation <PHONE> [--limit 30]
  openbsp send --to <PHONE> --text "mensagem"
  openbsp contacts [--search nome]
  openbsp query GET|POST|PATCH|DELETE <path> [--body '{...}']

Exemplos path query:
  GET /rest/v1/contacts?select=id,name&limit=10
  POST /rest/v1/messages
"@
    }
    "config" {
        $sub = if ($Rest.Count -gt 0) { $Rest[0] } else { "show" }
        if ($sub -eq "set") {
            # parse flags simples
            $cfg = @{ url = $Url; apikey = $Apikey; apikeySecret = $ApikeySecret; org = $Org }
            if (-not $cfg.url -or -not $cfg.apikey -or -not $cfg.apikeySecret -or -not $cfg.org) {
                Write-Host "Obrigatorio: --url --apikey --apikey-secret --org" -ForegroundColor Red
                exit 1
            }
            Save-Config $cfg
            Write-Host "Config salva em $ConfigPath" -ForegroundColor Green
        } else {
            if (Test-Path $ConfigPath) {
                $c = Get-Config
                Write-Host "url: $($c.url)"
                Write-Host "org: $($c.org)"
                Write-Host "apikey: $($c.apikey.Substring(0,[Math]::Min(8,$c.apikey.Length)))..."
            } else { Write-Host "Sem config" }
        }
    }
    "accounts" {
        Invoke-OpenBsp GET "/rest/v1/addresses?select=*&limit=$Limit"
    }
    "conversations" {
        Invoke-OpenBsp GET "/rest/v1/conversations?select=*&order=updated_at.desc&limit=$Limit"
    }
    "messages" {
        if (-not $Conversation) { Write-Host "Use --conversation PHONE"; exit 1 }
        $path = "/rest/v1/messages?conversation_address=eq.$Conversation&order=timestamp.desc&limit=$Limit"
        Invoke-OpenBsp GET $path
    }
    "contacts" {
        $path = "/rest/v1/contacts?select=*&limit=$Limit"
        if ($Search) { $path = "/rest/v1/contacts?name=ilike.*$Search*&select=*&limit=$Limit" }
        Invoke-OpenBsp GET $path
    }
    "send" {
        if (-not $To -or -not $Text) { Write-Host "Use --to PHONE --text `"msg`""; exit 1 }
        $c = Get-Config
        # organization_address: pega primeira address whatsapp se nao passar
        $addrs = Invoke-RestMethod -Method GET -Uri ($c.url.TrimEnd('/') + "/rest/v1/addresses?select=*&limit=1") -Headers @{
            apikey=$c.apikey; "api-key"=$c.apikeySecret
        }
        $orgAddr = $addrs[0].address
        $payload = @{
            organization_id      = $c.org
            organization_address = $orgAddr
            conversation_address = $To
            service              = "whatsapp"
            content              = @{
                version = "1"
                type    = "text"
                kind    = "text"
                text    = $Text
            }
        } | ConvertTo-Json -Depth 6
        Invoke-OpenBsp POST "/rest/v1/messages" $payload
    }
    "query" {
        $method = if ($Rest.Count -ge 1) { $Rest[0] } else { "GET" }
        $path   = if ($Rest.Count -ge 2) { $Rest[1] } else { "/rest/v1/" }
        Invoke-OpenBsp $method.ToUpper() $path $Body
    }
    default {
        Write-Host "Comando desconhecido: $Command. Use: openbsp help"
    }
}
