# Checkpoint & Resumption Procedure — Revolution X

## Purpose

Implement a verifiable mechanism for resuming Claude Code sessions after interruptions, enabling continuation from the correct point without re-running completed work.

## Checkpoint Format

A checkpoint is a JSON file written to `logs/checkpoint.json` that records:

```json
{
  "timestamp": "2026-10-22T19:26:04-03:00",
  "task_id": "mission-4-section-5-autocompact",
  "objective": "Investigate and document autocompact root cause",
  "last_completed_step": "doctor_claude_verification",
  "files_modified": [],
  "tests_run": ["tsc --noEmit", "eslint ."],
  "test_results": {
    "tsc": "0 errors",
    "eslint": "0 errors"
  },
  "blockers": [],
  "next_action": "lower CLASSCUDE_CODE_AUTO_COMPACT_WINDOW via settings backup+merge",
  "session_state": {
    "freeLLMAPI_healthy": true,
    "mcp_inventory_complete": true,
    "next_dev_running": true
  }
}
```

## Checkpoint Commands

### Write Checkpoint

```powershell
# After completing a logical step in a task
$checkpoint = @{
    timestamp = (Get-Date).toString("o")
    task_id = "mission-4-section-5-autocompact"
    objective = "Investigate and document autocompact root cause"
    last_completed_step = "doctor_claude_verification"
    files_modified = @()
    tests_run = @("tsc --noEmit", "eslint .")
    test_results = @{
        tsc = "0 errors"
        eslint = "0 errors"
    }
    blockers = @()
    next_action = "lower CLAUDE_CODE_AUTO_COMPACT_WINDOW via Claude Code settings backup+merge"
    session_state = @{
        freeLLMAPI_healthy = $true
        mcp_inventory_complete = $true
        next_dev_running = $true
    }
} | ConvertTo-Json -Depth 4

# Write to logs/checkpoint.json
$checkpoint | Out-File -FilePath "C:\Users\Bruno\.claude\Revolution\X\logs\checkpoint.json" -Encoding UTF8
Write-Log "Checkpoint gravado: $task_id" "INFO"
```

### Read Checkpoint

```powershell
# On session resume
if (Test-Path "C:\Users\Bruno\.claude\Revolution\X\logs\checkpoint.json") {
    $checkpoint = Get-Content "C:\Users\Bruno\.claude\Revolution\X\logs\checkpoint.json" | ConvertFrom-Json
    Write-Log "Checkpoint encontrado: $($checkpoint.task_id)" "INFO"
    Write-Log "Última etapa concluída: $($checkpoint.last_completed_step)" "INFO"
    Write-Log "Próxima ação: $($checkpoint.next_action)" "INFO"
    
    # Verify file state matches checkpoint
    if ($checkpoint.files_modified.Count -gt 0) {
        Write-Log "Arquivos esperados: $($checkpoint.files_modified -join ', ')" "INFO"
    }
} else {
    Write-Log "Nenhum checkpoint encontrado — iniciando do início da tarefa" "WARN"
}
```

## Resumption Procedure

### 1. On Session Resume

1. Read `logs/checkpoint.json` if it exists
2. Verify git status matches expected state
3. Verify key files exist and have expected content (compare hashes if needed)
4. Continue from `last_completed_step` or `next_action`
5. Do NOT re-run tests already verified in the checkpoint

### 2. Verify Before Resuming

```powershell
function VerifyResumeState {
    param(
        [string]$expectedTaskId,
        [array]$expectedFiles
    )
    
    $gitStatus = & git status --porcelain
    $checkpointExists = Test-Path "C:\Users\Bruno\.claude\Revolution\X\logs\checkpoint.json"
    
    if (-not $checkpointExists) {
        Write-Log "Nenhum checkpoint — não é seguro retomar automaticamente" "WARN"
        return $false
    }
    
    $checkpoint = Get-Content "C:\Users\Bruno\.claude\Revolution\X\logs\checkpoint.json" | ConvertFrom-Json
    
    if ($checkpoint.task_id -ne $expectedTaskId) {
        Write-Log "ID de tarefa não confere: esperado $expectedTaskId, encontrado $($checkpoint.task_id)" "ERROR"
        return $false
    }
    
    # Check git hasn't reverted key changes
    foreach ($file in $expectedFiles) {
        if (-not (Test-Path $file)) {
            Write-Log "Arquivo esperado ausente: $file" "ERROR"
            return $false
        }
    }
    
    Write-Log "Estado de retomada verificado com sucesso" "INFO"
    return $true
}
```

### 3. Differentiate Verified Resumption from Mere Log Persistence

| Verified Resumption | Mere Log Persistence |
|---------------------|----------------------|
| Checkpoint JSON exists with task_id, objective, last_completed_step | Only `logs/autostart.log` exists |
| Git status confirms expected file state | Logs may be incomplete or corrupted |
| Tests run and results recorded in checkpoint | No test verification |
| `next_action` specifies concrete next step | Unclear what to do next |
| Session can resume and continue from verified point | Session must restart from beginning |

## Supported Autocompact Mitigation

Per the documented evidence, the following is a **supported, non-breaking** config change:

```powershell
# Lower CLAUDE_CODE_AUTO_COMPACT_WINDOW via Claude Code settings backup+merge
# This is a supported approach that does NOT break the current running session

# The default 1048576 mismatches routed free model windows
# Recommended: set to model-specific value or 8192

# Mechanism: Claude Code settings.json backup, merge with lower value, restore
# Do NOT unset or remove the variable — just set to a lower value
```

**Important**: This change is recommended for FUTURE sessions via Claude Code settings backup+merge. It does not need to be applied to the current running session, and applying it to the current session is not supported without explicit user authorization.

## What Does NOT Work for Resumption

- Relying solely on `logs/autostart.log` text format (too unstructured)
- Assuming git state is unchanged without verification
- Resuming without checking the checkpoint JSON
- Declaring "autocompact fixed" without evidence from the specific session

## File Checklist

- `logs/checkpoint.json` — primary checkpoint (JSON, UTF-8)
- `logs/autostart.log` — execution logs (supplementary)
- `logs/autostart-backup-*` — config backups before changes
- `docs/AUTONOMOUS_EXECUTION_STATUS.md` — project phase status
- `docs/AUTOSTART_DIAGNOSTIC.md` — environment diagnosis