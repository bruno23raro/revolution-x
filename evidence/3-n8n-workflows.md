# Protocol P0.8 — n8n Workflows Closure (pasted_content id="9e37")

## 3.1 Canonical Instance Discovery
Per pasted_content id="9e37" step 3.1:
- **MCP cloud**: List workflows via `claude mcp list` → n8n-mcp connected
- **Local Docker**: `docker exec rx-n8n` — container running, healthy 7 hours
- **Current path**: Using MCP cloud for workflow execution (local REST API 401 blocker, documented in BLOCKERS.md)

## 3.2 WF-03: Drift Detection and Execution
Per pasted_content id="9e37" step 3.2:
- **Action**: Create `_drift`, execute, exigir alerta
- **Then**: Remove `_drift`
- **Expected**: Alert triggered on drift detection
- **Current status**: Pending — requires MCP cloud access or local Docker exec

## 3.3 WF-04: Severidade Distinctas em admin_alerts
Per pasted_content id="9e37" step 3.3:
- **Issue**: `admin_alerts.severity` has two distinct severities (critical vs warning)
- **Problem**: "Igual/igual → nó não lê o corpo, corrigir"
- **Action**: Fix the workflow so it properly reads the alert body and distinguishes severities
- **Current state**: 3 rows with organization_id=null were deleted in section 4 (evidence in protocol-section-4)

## 3.4 WF-05: 500 Simulado
Per pasted_content id="9e37" step 3.4:
- **Action**: Simulate 500 error → expect alerta
- **Without 500**: Silence (no alert)
- **Expected**: Workflow should generate alert on 500, remain silent otherwise

## 3.5 Execution IDs and Evidence
Per pasted_content id="9e37" step 3.5:
- **Location**: `evidence/n8n/` directory
- **Format**: Execution ID for each workflow (WF-03, WF-04, WF-05)
- **Status**: PASS/FAIL documented in `docs/N8N.md`
- **Current state**: 
  - `evidence/n8n/` directory exists but may be empty
  - `docs/N8N.md` needs updating with execution results

## 3.6 Blocker Status
- **Status**: PENDING — requires MCP cloud access or Docker exec
- **Note**: Local REST API documented as 401 blocker → contornado por MCP cloud (BLOCKERS.md)
- **Dependency**: Workflow execution needs valid authentication path