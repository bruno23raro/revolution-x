# Protocol: P0.8 — Execute without MCP
# Uses only curl.exe, Invoke-RestMethod, docker

$env:APP_ID = (Get-Content .env | Select-String "^APP_ID=").Line.Split("=")[1].Trim()
$env:APP_SECRET = (Get-Content .env | Select-String "^APP_SECRET=").Line.Split("=")[1].Trim()
$env:N8N_API_KEY = (Get-Content .env.local | Select-String "^N8N_API_KEY=").Line.Split("=")[1].Trim()
$env:AD_ACCOUNT_ID = (Get-Content .env | Select-String "^AD_ACCOUNT_ID=").Line.Split("=")[1].Split("#")[0].Trim()
$env:ACCESS_TOKEN = (Get-Content .env | Select-String "^ACCESS_TOKEN=").Line.Split("=")[1].Trim()

Write-Output "=== ENV CHECK ==="
Write-Output "APP_ID=$env:APP_ID"
Write-Output "APP_SECRET=$($env:APP_SECRET.Substring(0,8))..."
Write-Output "N8N_API_KEY=$($env:N8N_API_KEY.Substring(0,8))..."
Write-Output "AD_ACCOUNT_ID=$env:AD_ACCOUNT_ID"
Write-Output "ACCESS_TOKEN=$($env:ACCESS_TOKEN.Substring(0,30))..."

# 1.1 Get App Access Token
Write-Output "`n=== 1.1 GET APP ACCESS TOKEN ==="
$tokenUrl = "https://graph.facebook.com/v26.0/oauth/access_token?client_id=$env:APP_ID&client_secret=$env:APP_SECRET&grant_type=client_credentials"
$tokenResp = Invoke-RestMethod -Uri $tokenUrl -UseBasicParsing
$appToken = $tokenResp.access_token
Write-Output "STATUS: 200"
Write-Output "TOKEN: $($appToken.Substring(0,30))..."

# 1.2 Get Roles
Write-Output "`n=== 1.2 GET ROLES ==="
$rolesUrl = "https://graph.facebook.com/v26.0/$env:APP_ID/roles?access_token=$appToken"
$rolesResp = Invoke-RestMethod -Uri $rolesUrl -UseBasicParsing
Write-Output "STATUS: 200"
$rolesResp.data | ForEach-Object {
    Write-Output "  user=$($_.user.name) role=$($_.role.name)"
}

# 1.3 Get Me (system user)
Write-Output "`n=== 1.3 GET ME ==="
$meUrl = "https://graph.facebook.com/v26.0/me?access_token=$appToken"
try {
    $meResp = Invoke-RestMethod -Uri $meUrl -UseBasicParsing
    Write-Output "STATUS: 200"
    Write-Output "ID: $($meResp.id)"
    Write-Output "NAME: $($meResp.name)"
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}

# 1.4 Get Ad Account
Write-Output "`n=== 1.4 GET AD ACCOUNT ==="
$acctUrl = "https://graph.facebook.com/v26.0/act_$env:AD_ACCOUNT_ID?fields=id,name,account_status&access_token=$appToken"
try {
    $acctResp = Invoke-RestMethod -Uri $acctUrl -UseBasicParsing
    Write-Output "STATUS: 200"
    Write-Output "ID: $($acctResp.id)"
    Write-Output "NAME: $($acctResp.name)"
    Write-Output "ACCOUNT_STATUS: $($acctResp.account_status)"
} catch {
    $err = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Output "ERROR_CODE: $($err.error.code)"
    Write-Output "ERROR_SUBCODE: $($err.error.error_subcode)"
    Write-Output "ERROR_MSG: $($err.error.message)"
}

# 1.5 Get Ad Account with user token
Write-Output "`n=== 1.5 GET AD ACCOUNT (USER TOKEN) ==="
$acctUrl2 = "https://graph.facebook.com/v26.0/act_$env:AD_ACCOUNT_ID?fields=id,name,account_status&access_token=$env:ACCESS_TOKEN"
try {
    $acctResp2 = Invoke-RestMethod -Uri $acctUrl2 -UseBasicParsing
    Write-Output "STATUS: 200"
    Write-Output "ID: $($acctResp2.id)"
    Write-Output "NAME: $($acctResp2.name)"
    Write-Output "ACCOUNT_STATUS: $($acctResp2.account_status)"
} catch {
    $err = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Output "ERROR_CODE: $($err.error.code)"
    Write-Output "ERROR_SUBCODE: $($err.error.error_subcode)"
    Write-Output "ERROR_MSG: $($err.error.message)"
}

# 1.6 Get System Users
Write-Output "`n=== 1.6 GET SYSTEM USERS ==="
$sysUsersUrl = "https://graph.facebook.com/v26.0/$env:APP_ID/systemusers?access_token=$appToken"
try {
    $sysUsersResp = Invoke-RestMethod -Uri $sysUsersUrl -UseBasicParsing
    Write-Output "STATUS: 200"
    $sysUsersResp.data | ForEach-Object {
        Write-Output "  id=$($_.id) name=$($_.name) role=$($_.role.name) status=$($_.status)"
    }
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}

# 2.1 N8N Workflows
Write-Output "`n=== 2.1 N8N WORKFLOWS ==="
try {
    $n8nResp = Invoke-RestMethod -Uri "http://localhost:5678/api/v1/workflows" -Headers @{"X-N8N-API-KEY"=$env:N8N_API_KEY} -UseBasicParsing
    Write-Output "STATUS: 200"
    Write-Output "COUNT: $($n8nResp.data.Count)"
    $n8nResp.data | ForEach-Object {
        Write-Output "  id=$($_.id) name=$($_.name) active=$($_.active)"
    }
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}

# 3.1 Chrome CDP
Write-Output "`n=== 3.1 CHROME CDP ==="
try {
    $cdpResp = Invoke-RestMethod -Uri "http://127.0.0.1:9222/json/version" -UseBasicParsing
    Write-Output "CDP_VERSION: $($cdpResp.Browser)"
    Write-Output "STATUS: 200"
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}

# 4. Docker check
Write-Output "`n=== 4. DOCKER ==="
docker ps --format "{{.Names}}`t{{.Status}}" 2>&1 | Select-Object -First 5