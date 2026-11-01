$env:Content = Get-Content "C:\Users\Bruno\.claude\Revolution\.env.local" -Encoding UTF8
Write-Output "=== .env.local content (first 50 lines) ==="
$env:Content[0..49] | ForEach-Object { Write-Output "$_" }

Write-Output "`n=== Search for N8N_API_KEY ==="
$n8nLine = ($env:Content | Where-Object { $_ -match "^N8N_API_KEY=" })
Write-Output "N8N_API_KEY line: $n8nLine"

if ($n8nLine) {
    $keyValue = $n8nLine -replace "^N8N_API_KEY=", ""
    Write-Output "Key value: $keyValue"
    Write-Output "Key length: $($keyValue.Length)"

    # Test the key with X-N8N-API-KEY header
    Write-Output "`n=== Testing with extracted key via X-N8N-API-KEY ==="
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5678/api/v1/workflows" -Headers @{"X-N8N-API-KEY"=$keyValue} -UseBasicParsing -ErrorAction Stop
        Write-Output "X-N8N-API-KEY: STATUS $($resp.StatusCode)"
        Write-Output "X-N8N-API-KEY BODY: $($resp.Content.Substring(0,300))"
    } catch {
        Write-Output "X-N8N-API-KEY: EXCEPTION - $($_.Exception.Message)"
    }

    # Test without prefix
    try {
        $resp2 = Invoke-WebRequest -Uri "http://localhost:5678/api/v1/workflows" -Headers @{"X-N8N-API-KEY"=$keyValue} -UseBasicParsing -ErrorAction Stop
        Write-Output "X-N8N-API-KEY (no prefix): STATUS $($resp2.StatusCode)"
    } catch {
        Write-Output "X-N8N-API-KEY (no prefix): EXCEPTION - $($_.Exception.Message)"
    }
}