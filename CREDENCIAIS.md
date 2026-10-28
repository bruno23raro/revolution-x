# Credenciais — Revolution X

Regra: aqui vao APENAS identificadores e referencias. Valores puros vivem em
`.env` / `.env.local`. Mascarar sempre (primeiros 8 + ultimos 4).

| Variavel | Onde vive | Finalidade | Valor mascarado | Status |
|---|---|---|---|---|
| META_APP_ID | .env.local | App Meta | 11121577 | OK |
| META_APP_SECRET | .env.local | App Meta | — | OK |
| META_WEBHOOK_VERIFY_TOKEN | .env.local | Webhook | — | OK |
| META_TOKEN_ENCRYPTION_KEY | .env.local | Criptografia token-a-token | — | OK |
| SUPABASE_SERVICE_ROLE_KEY | .env.local | Admin Supabase | — | OK |
| GEMINI_API_KEY | .mcp.json | MCP de imagem | AQ.Ab8RN6...M3_g-- | OK |
| ACCESS_TOKEN | .env | System user (Ads CLI) | 11121577...dvpONKF8s | OK |
| AD_ACCOUNT_ID | .env | Ads CLI | 984184351272559 (Bla, ACTIVE) | OK |
| PAGE_ID | .env | Criativos | 645320171988542 (Central Da Black01) | OK |