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
| POSTGRES_PASSWORD (local) | supabase-docker/.env | Supabase self-hosted dev (docker) | rx593ce2...a375 | OK |
| JWT_SECRET (local) | supabase-docker/.env | Stack local (ANON/SERVICE reassinados) | 03cfb678...2a71 | OK |
| DASHBOARD_PASSWORD (local) | supabase-docker/.env | Studio basic-auth admin | Rx6b8b5a...9ae! | OK |
| META_PIXEL_ID | .env.local | Pixel Meta (CAPI) | 17189642...7989 | OK (evento teste aceito) |
| META_CAPI_ACCESS_TOKEN | .env.local | Conversions API (POST /{PIXEL}/events) | EAAUCuAG...ZDZD | OK (validado 2026-10-29) |
| EMAIL_API_KEY (Resend) | .env.local + hPanel | SMTP/emails transacionais | re_L3KSbf...ey2Rm | OK (email delivered 2026-10-29) |
| EMAIL_FROM | .env.local + hPanel | Remetente padrão | no-reply@revolutionx.com.br | OK |
| SUPABASE_DEV_DB_PASSWORD | .env.local | Senha Postgres DEV (rotacionada) | RxDev!j3g...9p6u9 | Rotacionada; aguardando propagação |
| SEARXNG_URL | .env.local | Busca local (docker) | http://localhost:8888 | Config criado |
| WHATSAPP_PROVIDER | .env.local | Factory do provedor oficial | openbsp | OK |
| OPENBSP_BASE_URL | .env.local | PostgREST do OpenBSP | https://nheelwshzbgenpavwhcy.supabase.co/rest/v1 | OK |
| OPENBSP_PUBLISHABLE_KEY | .env.local | Chave publica OpenBSP (header apikey) | sb_publ...hUd_ | OK (publica por design; validada ao vivo 2026-10-29) |
| OPENBSP_API_KEY | .env.local | Chave owner OpenBSP "REVOLUTION X" (header api-key) | sk_dcca...1699 | OK (mint onboarding_token 201 ao vivo 2026-10-29) |
| OPENBSP_ORG_ID | .env.local | Organizacao OpenBSP "REVOLUTION X" | 9d7114cd...6514 | OK (lida do proprio GET organizations) |