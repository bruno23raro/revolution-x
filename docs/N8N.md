# N8N Workflows — Revolution X

## Workflow Table

| # | Name | ID | Active | Last Execution ID | PASS/FAIL |
|---|------|-----|--------|-------------------|-----------|
| 1 | WF-01_ingest-webhook | rxWf000000000001 | true | - | - |
| 2 | WF-02_meta-capi-retry | rxWf000000000002 | true | - | - |
| 3 | WF-03_recon-noturno | rxWf000000000003 | true | - | - |
| 4 | WF-04_alerta-5xx | rxWf000000000004 | true | - | - |
| 5 | WF-05_integracao-poll | rxWf000000000005 | true | - | - |

## WF-04 — Severity Fix (CRITICAL)

**Before:** The send_whatsapp_critical node hardcoded no severity field in the JSON body, 
causing the application endpoint /api/admin/notify-whatsapp to default to 'warning' severity.

**After:** The jsonBody now includes dynamic severity from the alert payload:
- "severity": "={{ .severity }}" 
- Message uses {{ .severity | uppercase }} to display the actual severity

**File:** 
8n/workflows/WF-04_alerta-5xx.json (exported and updated)

**Test Results:**
- Critical payload: {"type":"5xx_error","severity":"critical","message":"Test critical",...} 
  → Workflow started, severity should flow to AdminAlert
- Warning payload: {"type":"5xx_error","severity":"warning","message":"Test warning",...}
  → Workflow started, severity should flow to AdminAlert

## WF-03 — Schema Drift Detection

**Setup:** Added dummy column dummy_col_for_drift_test to Organization table in Supabase DB 
to simulate schema drift.

**Expected Result:** When WF-03 executes, it should detect hasDrift: true from the 
/api/admin/schema/diff endpoint and create an AdminAlert with:
- 	ype='schema_drift'
- severity='critical'

**Execution:** Attempted via 
8n execute --id rxWf000000000003 but n8n API authentication 
prevented execution. The cron workflow structure requires proper API credentials.

## WF-05 — Integration Poll

**Normal Scenario:** /api/integrations/status returns 200 → no alert should be created

**500 Simulated:** Use mock to make /api/integrations/status return 500 → should create 
AdminAlert with 	ype='integration_status_500'

**Execution:** Attempted via n8n API but authentication issues prevented execution.

**Evidence Files:** To be saved in evidence/n8n/ as JSON files
