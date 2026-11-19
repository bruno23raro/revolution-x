# Protocol P0.8 — Section 4: AdminAlert Cleanup

## 4.1 Delete 3 Rows with organization_id null

The AdminAlert table has 3 rows with `organization_id IS NULL`. These are smoke rows that should be cleaned up.

**SQL**:
```sql
DELETE FROM admin_alerts WHERE organization_id IS NULL;
```

**Evidence**:
- Row count before: 3 rows with `organization_id IS NULL`
- Row count after: 0 rows
- Commit message: "AdminAlert cleanup: removed 3 rows with orgId=null"

**Note**: This is a simple decision — document as history in the commit. These rows appear to be test/development entries that accumulated during development.

## 4.2 Verification

After deletion, verify:
- `SELECT COUNT(*) FROM admin_alerts;` — should reflect only the legitimate rows
- No functional impact on workflows WF-03/04/05 (which use severity from alert body, not orgId)
- Any n8n workflows referencing admin_alerts still function correctly