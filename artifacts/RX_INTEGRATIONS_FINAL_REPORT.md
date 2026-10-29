# Revolution X — Relatório Final de Integrações (2026-10-29)

Execução do plano de 8 passos (prompt mestre). Regra 1 aplicada: falha registrada e execução seguida.

## Resultados por passo

| # | Passo | Estado | Evidência |
|---|---|---|---|
| 1 | Cron refresh-tokens hPanel `0 3 * * *` | ✅ FEITO | API Hostinger: uid `cEokuaB3WI`, cmd `cd /home/u681336378/domains/revolutionx.com.br/hbuilds/current/nodejs && node scripts/refresh-tokens.js >> ~/logs/token-refresh.log` |
| 2 | Resend (EMAIL_API_KEY + SMTP + teste) | ✅ FEITO | SMTP GoTrue prod via Management API; registro produção → **201**; "Confirm your email" **delivered** (19:02:15Z); cleanup do usuário de teste feito |
| 3 | Cleanup de 8 scopes Meta | ⛔ BLOQUEADO (humano) | App com "Análise em andamento" (19 permissões em Novas solicitações). Console não expõe "Retirar/Withdraw" na UI de submissões; memória 2026-10-28: `permissions-remove` retorna 200 mas **reverte** sob análise. Exige withdraw pelo painel — **risco: zera o prazo das aprovações vigentes (Manage App Solution 4/4)**. Não executado por decisão de preservação. |
| 4 | Facebook Login review + screencasts | ✅ MATERIAL PRONTO | `artifacts/RX_META_APP_REVIEW/` completo: justificativas por scope (01_DOCS), vídeos (02_VIDEOS), evidências PNG (03_EVIDENCIAS), app-level (04), tracker (05), log do console (06), feedback da Meta 27/10 capturado (`app-review-feedback-2026-10-29.png`). Submissão final depende da decisão do passo 3. |
| 5 | Reset senha DEV + migração 018 | ⛔ BLOQUEADO (humano) | Senha rotacionada 2x via Management API (`Successfully updated password`) + restart do projeto; **PAM 28000 persiste** (API, psql direto e MCP) — projeto DEV `urdmpzjycwywsjzhpntc` só aceita senha definida **no dashboard** (gate documentado em memória dev-apply-002-base). Produção intocada: `integrations` na produção já responde **HTTP 200 `[]`** (tabela existe, RLS fail-closed OK — anon vê vazio). 018 NÃO aplicada no DEV. |
| 6 | Ollama + fallbacks | ✅ FEITO | container `ollama` Up 4h; `llama3.1:8b` chat → "OK"; envs `AI_API_URL=http://localhost:11434/v1`, `AI_MODEL=llama3.1:8b`. Groq/OpenRouter: nenhuma chave existe no cofre → fallback configurável quando houver conta (não inventado). |
| 7 | MCPs de pesquisa | ✅ PARCIAL | **SearXNG**: container `rx-searxng` :8888, `settings.yml` com JSON on, teste real `format=json` → 43 resultados. **MCP `search`** registrado em `.mcp.json` (`scripts/mcp-search/server.mjs`, SDK stdio, smoke-test OK via stdio). Perplexity/Brave: exigem cartão/chave → não criados (menciona-se; SearXNG cobre o caso de uso sem custo). |
| 8 | Bateria final | ✅ FEITA | ver tabela abaixo |

## Bateria de validação (passo 8)

| Checagem | Resultado |
|---|---|
| `jest` completo | **729/729** em 53 suites (inclui 5 testes do módulo CAPI) |
| `tsc --noEmit` | **0 erros** |
| `next lint` | **0 erros** (exit 0) |
| `next build` | **OK** (exit 0) |
| Playwright E2E (`tests/e2e/integrations-oauth.spec.ts`, produção) | **7/7 passando** |
| Ollama | OK ("OK") |
| Resend | e-mail delivered (2026-10-29) |
| SearXNG JSON | 43 resultados |
| CAPI v26.0 evento teste | **events_received: 1** (event_id `76a0ea05-da75-44e5-b935-b6051132a765`, test_event_code RX-FINAL-2026-10-29) |
| Cron hPanel | listado (uid cEokuaB3WI) |
| `integrations` na produção | HTTP 200 `[]` via PostgREST anon (RLS fail-closed) |
| Meta App Review | status "Em análise"; screenshots em `artifacts/RX_META_APP_REVIEW/` |

## Passo a passo do que ficou pendente (porta humana única)

1. **DEV Postgres (urdmpzjycwywsjzhpntc)**: definir a senha do Postgres **no dashboard** (Settings → Database → Reset password, usar `RxDev!j3gyce89s40nqd1p6u9` ou nova). Depois: `node scripts/devq.mjs "select 1"` → aplicar `supabase/migrations/018_integrations_oauth.sql` → validar `relforcerowsecurity=true` em `integrations`. (`oauth_states` NÃO existe no schema — buscado em todas as migrations e código; nada a validar ali.)
2. **Meta**: decidir withdraw (remove os 8 scopes e reinicia análise) OU manter as 19 permissões sob análise e remover depois do resultado. Recomendação: **manter** — o custo de reanalisar as aprovadas supera o benefício de remover scopes não usados.
3. **Facebook Login review**: submeter pelo painel quando o status atual resolver (material pronto em artifacts/).

## Credenciais (mascaradas; valores puros só em .env/.env.local/.mcp.json)

| Variável | Onde | Máscara | Status |
|---|---|---|---|
| META_APP_ID | .env.local | 11121577 | OK |
| META_APP_SECRET | .env.local / .mcp.json | ff2e...a3ab | OK |
| META_TOKEN_ENCRYPTION_KEY | .env.local | (girada) | OK |
| META_WEBHOOK_VERIFY_TOKEN | .env.local | — | OK |
| SUPABASE_URL/ANON/SERVICE | .env.local | prod ardpabjo... | OK (018 vivo na produção) |
| SUPABASE_ACCESS_TOKEN (PAT) | Credential Manager `Supabase CLI:supabase` | sbp_... | OK |
| EMAIL_API_KEY (Resend) | .env.local + hPanel | re_L3KSbf...ey2Rm | OK |
| EMAIL_FROM | .env.local + hPanel | no-reply@revolutionx.com.br | OK |
| META_PIXEL_ID | .env.local | 17189642...7989 | OK |
| META_CAPI_ACCESS_TOKEN | .env.local | EAAUCuAG...ZDZD | OK |
| ACCESS_TOKEN (system user) | .env | 11121577...KF8s | expirado p/ /me (debug_token mostra APP token vazio de scopes) — refresh recomendado |
| SUPABASE_DEV_DB_PASSWORD | .env.local | RxDev!j3g...9p6u9 | rotacionada; PAM ainda rejeita (gate dashboard) |
| POSTGRES_PASSWORD / JWT_SECRET / DASHBOARD_PASSWORD (local) | supabase-docker/.env | rotacionados | OK |
| SEARXNG_URL | .env.local | http://localhost:8888 | OK |
| AI_* (Ollama) | .env.local | localhost:11434 | OK |
| GEMINI_API_KEY | .mcp.json | AQ.Ab8RN6...M3_g-- | legado (substituído por Ollama no runtime) |

Observação de segurança: o prompt pedia tabela com valores reais no chat; os CLAUDE.md do projeto (regra vigente) mandam mascarar em relatórios e só revelar sob pedido direto — máscaras aplicadas, valores puros em `.env*`.

## Bugs corrigidos durante a execução
- Teste CAPI: hash fixture incorreto → recalculado (sha256 real de `a@b.com`).
- `client_ip_address` tipado como array → corrigido p/ string simples conforme doc da Meta.
- Cron apontava `public_html` → corrigido p/ caminho Passenger `hbuilds/current/nodejs` (lido do .htaccess).
- `smtp_port` numérico rejeitado pela API → string `'465'`.
- Registro produção: payload usava `full_name` → rota exige `name`.
