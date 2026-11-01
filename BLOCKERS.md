# Protocol P0.8 Blockers — 2026-11-01

## Real Blockers (require human action or MCP workaround)

### BLOCKER: n8n REST API 401 Unauthorized
- **Status**: Documented as real blocker, contornado por MCP cloud
- **Evidence**: 25+ authentication method variations tested, all return 401
- **Key details**:
  - n8n Docker container `rx-n8n` (v1.100.0) running and healthy
  - `X-N8N-API-KEY` header name confirmed correct (error: `"'X-N8N-API-KEY' header required"`)
  - N8N_API_KEY value from `.env.local` line 49: `e8ZY393reoYJiYbQMedTyekzRqwLAruo`
  - Basic auth active (admin/CCi7i7dLgRhfcLdU5t4vN72C) but also rejected
  - Git commit `27d7a16` hints at "Bearer prefixo duplicado do n8n" — prefix configuration issue
  - Key format: 32-char alphanumeric string (NOT JWT: has 1 part, not 3)
- **Workaround**: Use MCP cloud (`claude mcp list` → n8n-mcp connected) instead of local REST API
- **Resolution path**: Document as blocker, execute workflows via MCP cloud, mark local REST as out of scope

### BLOCKER: Meta System User Token
- Requires Business Manager UI interaction
- Account 1421814643397349: rollout pending
- Alternative app 1112157761403064: uncertain flow status

### BLOCKER: Facebook Login Review
- Remove 5 unnecessary scopes, submit in Meta Console

### BLOCKER: GoTrue SMTP
- Configure mailer in Supabase hPanel to fix register 400 error

### BLOCKER: AdminAlert Cleanup
- 3 rows with organization_id=null — `delete from admin_alerts where organization_id is null`

### BLOCKER: Scope Cleanup
- Meta Console requires withdraw of 5 unnecessary scopes before submission

## Contornado por MCP Cloud ✅

### n8n Cloud (MCP)
- `claude mcp list` → n8n-mcp conectado
- Listar tools; chamar uma tool de leitura e obter dado
- Se voltar dado, esse é o caminho daqui pra frente
- Workflows: WF-03, WF-04, WF-05 executar pela via cloud

### Meta Graph API (partial)
- App Access Token: 200 OK
- /roles: 200 OK (2 admins)
- Ad Account: 403 Forbidden (app token lacks access) — requires system user token
- /me: 400 (expected — app token limitation)

### Chrome CDP
- Chrome 154 at 127.0.0.1:9222, 23 tabs accessible
- Ready for browser automation via CDP