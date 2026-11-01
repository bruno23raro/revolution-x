$env:APP_ID = (Get-Content .env | Select-String "^APP_ID=").Line.Split("=")[1].Trim()
$env:APP_SECRET = (Get-Content .env | Select-String "^APP_SECRET=").Line.Split("=")[1].Trim()
$env:AD_ACCOUNT_ID = (Get-Content .env | Select-String "^AD_ACCOUNT_ID=").Line.Split("=")[1].Split("#")[0].Trim()
$env:ACCESS_TOKEN = (Get-Content .env | Select-String "^ACCESS_TOKEN=").Line.Split("=")[1].Trim()
$env:N8N_API_KEY = (Get-Content .env.local | Select-String "^N8N_API_KEY=").Line.Split("=")[1].Trim()

Write-Output "=== 1.4 AD ACCOUNT (app token) ==="
$tokenUrl = "https://graph.facebook.com/v26.0/oauth/access_token?client_id=$env:APP_ID&client_secret=$env:APP_SECRET&grant_type=client_credentials"
$tokenResp = Invoke-RestMethod -Uri $tokenUrl -UseBasicParsing
$appToken = $tokenResp.access_token
$acctUrl = "https://graph.facebook.com/v26.0/act_$env:AD_ACCOUNT_ID?fields=id,name,account_status&access_token=$appToken"
try {
    $resp = Invoke-WebRequest -Uri $acctUrl -UseBasicParsing -ErrorAction Stop
    Write-Output "STATUS: $($resp.StatusCode)"
    Write-Output "BODY: $($resp.Content)"
} catch {
    Write-Output "EXCEPTION: $($_.Exception.Message)"
    Write-Output "STATUS CODE: $($_.Exception.Response.StatusCode)"
    if ($_.Exception.Response.Content) {
        Write-Output "BODY: $($_.Exception.Response.Content)"
    } else {
        Write-Output "BODY: (null)"
    }
}

Write-Output "`n=== 1.5 AD ACCOUNT (user token) ==="
$acctUrl2 = "https://graph.facebook.com/v26.0/act_$env:AD_ACCOUNT_ID?fields=id,name,account_status&access_token=$env:ACCESS_TOKEN"
try {
    $resp2 = Invoke-WebRequest -Uri $acctUrl2 -UseBasicParsing -ErrorAction Stop
    Write-Output "STATUS: $($resp2.StatusCode)"
    Write-Output "BODY: $($resp2.Content)"
} catch {
    Write-Output "EXCEPTION: $($_.Exception.Message)"
    Write-Output "STATUS CODE: $($_.Exception.Response.StatusCode)"
    if ($_.Exception.Response.Content) {
        Write-Output "BODY: $($_.Exception.Response.Content)"
    } else {
        Write-Output "BODY: (null)"
    }
}

Write-Output "`n=== 1.6 SYSTEM USERS ==="
$sysUsersUrl = "https://graph.facebook.com/v26.0/$env:APP_ID/systemusers?access_token=$appToken"
try {
    $resp3 = Invoke-WebRequest -Uri $sysUsersUrl -UseBasicParsing -ErrorAction Stop
    Write-Output "STATUS: $($resp3.StatusCode)"
    Write-Output "BODY: $($resp3.Content)"
} catch {
    Write-Output "EXCEPTION: $($_.Exception.Message)"
    Write-Output "STATUS CODE: $($_.Exception.Response.StatusCode)"
    if ($_.Exception.Response.Content) {
        Write-Output "BODY: $($_.Exception.Response.Content)"
    } else {
        Write-Output "BODY: (null)"
    }
}

Write-Output "`n=== 1.7 GET ME (user token) ==="
$meUrl = "https://graph.facebook.com/v26.0/me?access_token=$env:ACCESS_TOKEN"
try {
    $resp4 = Invoke-WebRequest -Uri $meUrl -UseBasicParsing -ErrorAction Stop
    Write-Output "STATUS: $($resp4.StatusCode)"
    Write-Output "BODY: $($resp4.Content)"
} catch {
    Write-Output "EXCEPTION: $($_.Exception.Message)"
    Write-Output "STATUS CODE: $($_.Exception.Response.StatusCode)"
    if ($_.Exception.Response.Content) {
        Write-Output "BODY: $($_.Exception.Response.Content)"
    } else {
        Write-Output "BODY: (null)"
    }
}

Write-Output "`n=== 2.1 N8N WORKFLOWS ==="
try {
    $n8nResp = Invoke-WebRequest -Uri "http://localhost:5678/api/v1/workflows" -Headers @{"X-N8N-API-KEY"=$env:N8N_API_KEY} -UseBasicParsing -ErrorAction Stop
    Write-Output "STATUS: $($n8nResp.StatusCode)"
    Write-Output "BODY: $($n8nResp.Content)"
} catch {
    Write-Output "EXCEPTION: $($_.Exception.Message)"
    Write-Output "STATUS CODE: $($_.Exception.Response.StatusCode)"
    if ($_.Exception.Response.Content) {
        Write-Output "BODY: $($_.Exception.Response.Content)"
    } else {
        Write-Output "BODY: (null)"
    }
}

Write-Output "`n=== 2.2 N8N WORKFLOWS (no auth) ==="
try {
    $n8nResp2 = Invoke-WebRequest -Uri "http://localhost:5678/api/v1/workflows" -UseBasicParsing -ErrorAction Stop
    Write-Output "STATUS: $($n8nResp2.StatusCode)"
    Write-Output "BODY: $($n8nResp2.Content)"
} catch {
    Write-Output "EXCEPTION: $($_.Exception.Message)"
    Write-Output "STATUS CODE: $($_.Exception.Response.StatusCode)"
    if ($_.Exception.Response.Content) {
        Write-Output "BODY: $($_.Exception.Response.Content)"
    } else {
        Write-Output "BODY: (null)"
    }
}