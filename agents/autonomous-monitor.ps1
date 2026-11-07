# Autonomous Monitor - Revolution X (PowerShell)
# Detecta e corrige erros automaticamente

param(
    [string]$Path = ".",
    [switch]$Fix = $true,
    [switch]$NoExit = $false
)

$ErrorPatterns = @(
    "Property '\w+' does not exist",
    "Argument of type '\w+' is not assignable",
    "Object is possibly 'undefined'",
    "Object is possibly 'null'",
    "\.eq\(['\"](\w+)['\"]\)",
    "column.*mismatch",
    "Cannot find module",
    "undefined is not a function",
    "Cannot read property",
    "null is not an object"
)

$KnownFixes = @{
    "organization_id" = "organizationId"
    "organizationID" = "organizationId"
    "last_checked_at" = "lastCheckedAt"
    "last_error" = "lastError"
    "rejection_reason" = "rejectionReason"
    "access_token_enc" = "accessTokenEnc"
    "waba_id" = "wabaId"
    "organization_address" = "organizationAddress"
}

class AutonomousMonitor {
    [array]$Errors = @()
    [array]$FixesApplied = @()

    [array] GetAllTsFiles([string]$Directory) {
        $files = @()
        $excludeDirs = @("node_modules", ".next", "out", "dist", "public", ".git")

        Get-ChildItem -Path $Directory -Recurse -File | Where-Object {
            $_.Extension -in @(".ts", ".tsx") -and
            $_.DirectoryName -and
            ($excludeDirs | Where-Object { $_.ToString() -notin $_.DirectoryName -split "\\" })
        } | ForEach-Object { $files += $_.FullName }

        return $files
    }

    [array] ScanFile([string]$FilePath) {
        $errors = @()

        try {
            $content = Get-Content -Path $FilePath -Raw
            $lines = Get-Content -Path $FilePath

            for ($i = 0; $i -lt $lines.Count; $i++) {
                $line = $lines[$i]

                foreach ($pattern in $ErrorPatterns) {
                    if ($line -match $pattern) {
                        $severity = if ($line -match "Error|Failed|TypeError") { "critical" } else { "medium" }

                        $errors += [PSCustomObject]@{
                            File = $FilePath
                            Line = $i + 1
                            Content = $line.Trim()
                            Pattern = $pattern
                            Severity = $severity
                        }
                    }
                }
            }
        } catch {
            # File access error - skip
        }

        return $errors
    }

    [bool] FixFile([string]$FilePath, [hashtable]$Fixes) {
        try {
            $content = Get-Content -Path $FilePath -Raw
            $modified = $false

            foreach ($fix in $Fixes.GetEnumerator()) {
                if ($content -match $fix.Key) {
                    $content = $content -replace [regex]::Escape($fix.Key), $fix.Value
                    Write-Host "  ✅ Fixed: $($fix.Key) → $($fix.Value)"
                    $modified = $true
                }
            }

            if ($modified) {
                Set-Content -Path $FilePath -Value $content -NoNewline
                return $true
            }

            return $false
        } catch {
            Write-Host "  ❌ Error fixing $FilePath`: $($_.Exception.Message)"
            return $false
        }
    }

    [void] Run() {
        Write-Host "🚀 Autonomous Monitor Starting..."
        Write-Host "===================================="

        # Create reports directory
        if (-not (Test-Path "reports")) {
            New-Item -Path "reports" -ItemType Directory -Force | Out-Null
        }

        # Scan for errors
        Write-Host "`n🔍 Scanning for errors..."
        $files = $this.GetAllTsFiles($Path)
        Write-Host "📁 Found $($files.Count) TypeScript files to scan"

        $allErrors = @()
        foreach ($file in $files) {
            $errors = $this.ScanFile($file)
            $allErrors += $errors
        }

        Write-Host "🐛 Found $($allErrors.Count) potential issues"

        # Group errors by file
        $errorsByFile = @{}
        foreach ($error in $allErrors) {
            if (-not $errorsByFile.ContainsKey($error.File)) {
                $errorsByFile[$error.File] = @()
            }
            $errorsByFile[$error.File] += $error
        }

        # Apply automated fixes
        if ($Fix -and $errorsByFile.Keys.Count -gt 0) {
            Write-Host "`n🔧 Applying automated fixes..."

            foreach ($file in $errorsByFile.Keys) {
                $fixesToApply = @{}

                foreach ($error in $errorsByFile[$file]) {
                    foreach ($fix in $KnownFixes.GetEnumerator()) {
                        if ($error.Content -match $fix.Key) {
                            $fixesToApply[$fix.Key] = $fix.Value
                        }
                    }
                }

                if ($fixesToApply.Count -gt 0) {
                    $fixed = $this.FixFile($file, $fixesToApply)
                    if ($fixed) {
                        $this.FixesApplied += [PSCustomObject]@{ File = $file; Fixes = $fixesToApply }
                    }
                }
            }
        }

        # Summary
        Write-Host "`n📊 Scan Complete"
        Write-Host "================="
        Write-Host "Errors found: $($allErrors.Count)"
        Write-Host "Fixes applied: $($this.FixesApplied.Count)"

        if ($allErrors.Count -gt 0) {
            Write-Host "`n⚠️  Remaining issues:"
            $allErrors | Select-Object -First 10 | ForEach-Object {
                Write-Host "  $($_.File):$($_.Line) - $($_.Severity.ToUpper())"
            }

            if (-not $NoExit) {
                exit 1
            }
        } else {
            Write-Host "`n✅ No errors found!"
            if (-not $NoExit) {
                exit 0
            }
        }
    }
}

# Execute
$monitor = [AutonomousMonitor]::new()
$monitor.Run()