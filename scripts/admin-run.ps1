param([Parameter(Mandatory=$true)][string]$Cmd, [string]$Dir = "C:\Users\Bruno\.claude\Revolution\X")
$log = Join-Path $env:TEMP ("rx_admin_" + [guid]::NewGuid().ToString("N") + ".log")
$body = "Set-Location '$Dir'; try { $Cmd 2>&1 | Tee-Object -FilePath '$log' } catch { `$_ 2>&1 | Tee-Object -FilePath '$log' }; exit `$LASTEXITCODE"
Start-Process powershell -Verb RunAs -Wait -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-Command",$body
if (Test-Path $log) { Get-Content $log; Remove-Item $log -Force }