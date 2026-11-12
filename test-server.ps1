# PowerShell script para testar servidor demo
$url = "http://127.0.0.1:4000"

Write-Host "Testing server at $url..." -ForegroundColor Cyan

# Test 1: Check if server responds
try {
    $response = Invoke-WebRequest -Uri "$url/api/dev/demo-login" -Method POST -TimeoutSec 5 -ErrorAction Stop
    Write-Host "POST /api/dev/demo-login returned $($response.StatusCode)" -ForegroundColor Green

    # Parse response
    $json = $response.Content | ConvertFrom-Json
    Write-Host "User: $($json.user.email), Demo: $($json.demo)" -ForegroundColor White

    # Extract cookies from response headers
    Set-Cookie -String $response.Headers 'Set-Cookie'

    Write-Host "`nTest completed successfully!" -ForegroundColor Yellow
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "Server not running or not accessible at $url" -ForegroundColor Red
}