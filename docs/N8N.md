# n8n — Camada de Orquestração Revolution X

> **Princípio:** n8n NÃO substitui lógica de app. Os endpoints continuam sendo a fonte de verdade; o n8n chama, reexecuta e monitora. Banco próprio (`n8n` Postgres), nunca o do app.

---

## 0. Instalação Rápida

```bash
# 1. Garantir que .env.local tem as 7 variáveis N8N_* (já geradas neste turno)
# 2. Subir stack
docker compose -f n8n/docker-compose.yml up -d

# 3. Aguardar healthcheck (até 120s)
until curl -sf http://localhost:5678/healthz; do sleep 2; done

# 4. Acessar UI
# http://localhost:5678  (user: admin, senha = N8N_BASIC_AUTH_PASSWORD do .env.local)
```

---

## 1. Variáveis de Ambiente (em `.env.local`)

| Variável | Descrição | Exemplo |
|---|---|---|
| `N8N_ENCRYPTION_KEY` | 64 chars hex — chave de criptografia dos credentials no banco n8n | `a1b2c3d4e5f6...` |
| `N8N_DATABASE_NAME` | Nome do DB n8n | `n8n` |
| `N8N_DATABASE_USER` | Usuário Postgres n8n | `n8n` |
| `N8N_DATABASE_PASSWORD` | Senha do DB n8n (32 chars) | `AbCdEfGh...` |
| `N8N_API_KEY` | Chave para chamar n8n API (32 chars) | `XyZ123...` |
| `N8N_BASIC_AUTH_USER` | User da UI n8n | `admin` |
| `N8N_BASIC_AUTH_PASSWORD` | Senha da UI n8n (24 chars) | `SeCrEt...` |

> **NUNCA** comite essas variáveis. Estão no `.env.local` (já no `.gitignore`).

---

## 2. Workflows (em `n8n/workflows/*.json`)

| Arquivo | ID | Trigger | Descrição |
|---|---|---|---|
| `WF-01_ingest-webhook.json` | `ingest` | Webhook POST `/webhook/ingest` | Recebe webhooks genéricos, valida HMAC-SHA256, responde 200 <300ms, encaminha para app, armazena dedup key |
| `WF-02_meta-capi-retry.json` | `capi-retry` | Webhook POST `/webhook/capi-retry` | Dispara eventos CAPI com backoff exponencial 3x (2s/4s/8s) e dead-letter ao esgotar |
| `WF-03_recon-noturno.json` | cron | Diário 03:00 BRT | Compara schema local (Prisma) vs migrations vs produção; falha em drift |
| `WF-04_alerta-5xx.json` | `alerta-5xx` | Webhook POST `/webhook/alerta-5xx` | Consome logs de erro 5xx e notifica no Slack/WhatsApp |
| `WF-05_integracao-poll.json` | cron | 4x/dia (0,6,12,18h) | Consulta `/api/integrations/status` e alerta em 500 ou usuário sem integrações ativas |

### 2.1 Importar e Ativar (via UI)

1. Acesse `http://localhost:5678` → login
2. Workflows → Import → selecione cada `.json` em `n8n/workflows/`
3. Para cada workflow: abra → clique **Activate** (canto superior direito)
4. Verifique se todos mostram "Active" na lista

### 2.2 Importar e Ativar (via API — script)

```bash
# Requer N8N_API_KEY no .env.local
API_KEY=$(grep N8N_API_KEY .env.local | cut -d= -f2)
for f in n8n/workflows/*.json; do
  curl -X POST http://localhost:5678/api/v1/workflows \
    -H "Content-Type: application/json" \
    -H "X-N8N-API-KEY: $API_KEY" \
    -d @$f
done

# Ativar cada um (pegar IDs retornados)
curl -X POST http://localhost:5678/api/v1/workflows/<ID>/activate \
  -H "X-N8N-API-KEY: $API_KEY"
```

✅ **Status atual:** Todos os 5 workflows foram importados e ativados via API/CLI.

---

## 3. Endpoints de Apoio Necessários no App

Todos os endpoints abaixo foram implementados e estão ativos. Os workflows n8n podem consumi-los plenamente.

| Workflow | Endpoint | Método | Status |
|---|---|---|---|
| WF-01 | `/api/webhooks/meta` | POST | ✅ Existe (`app/api/webhooks/meta/route.ts`) |
| WF-02 | `/api/admin/alerts` | POST | ✅ Implementado |
| WF-02 | `/api/admin/notify-slack` | POST | ✅ Implementado |
| WF-02 | `/api/admin/notify-whatsapp` | POST | ✅ Implementado |
| WF-03 | `/api/admin/schema/diff` | GET | ✅ Implementado |
| WF-04 | `/api/admin/alerts` | POST | ✅ Implementado |
| WF-04 | `/api/admin/notify-slack` | POST | ✅ Implementado |
| WF-04 | `/api/admin/notify-whatsapp` | POST | ✅ Implementado |
| WF-05 | `/api/integrations/status` | GET | ✅ Existe |
| WF-05 | `/api/admin/alerts` | POST | ✅ Implementado |

> **Nota:** Todos os endpoints administrativos `/api/admin/*` exigem papel admin/owner (autenticação via Supabase) e utilizam o banco dedicado `n8n` + Prisma `AdminAlert` model. Os tokens de acesso são lidos das variáveis `ADMIN_ALERT_TOKEN`, `SYSTEM_USER_TOKEN`, `ALERT_WHATSAPP_NUMBER` e `SLACK_ALERT_CHANNEL` no `.env.local`.

---

## 4. Variáveis Adicionais Referenciadas (adicionar ao `.env.local` conforme necessário)

```bash
# Para alertas
ADMIN_ALERT_TOKEN=          # Bearer token para autenticar chamadas admin
ALERT_WHATSAPP_NUMBER=      # Número destino WhatsApp (ex: 5511999999999)
SLACK_ALERT_CHANNEL=        # Canal Slack (ex: #alerts-production)
SYSTEM_USER_TOKEN=          # Token system user Meta para /api/integrations/status
```

---

## 5. Testar Cada Workflow Ponta a Ponta

### WF-01 — Ingest Webhook
```bash
# Simular webhook Meta válido (precisa HMAC correto)
curl -X POST http://localhost:5678/webhook/ingest \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=<HMAC_VALIDO>" \
  -d '{"entry":[{"changes":[{"value":{"metadata":{"phone_number_id":"123456789"}}}]}]}'
# Esperado: 200 { "status": "accepted", "queued": true }
```

### WF-02 — CAPI Retry
```bash
curl -X POST http://localhost:5678/webhook/capi-retry \
  -H "Content-Type: application/json" \
  -d '{"events":[{"eventName":"Purchase","eventId":"test-123","emails":["test@example.com"]}]}'
# Esperado: { "ok": true, "eventsReceived": 1 } (se META_PIXEL_ID e META_CAPI_ACCESS_TOKEN configurados)
```

### WF-03 — Recon Noturno
```bash
# Trigger manual para testar agora
curl -X POST http://localhost:5678/webhook/alerta-5xx \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -d '{"type":"schema_drift","driftSummary":{"missingTables":1},"severity":"critical"}'
# Verificar se Slack/WhatsApp recebem
```

### WF-04 — Alerta 5xx
```bash
curl -X POST http://localhost:5678/webhook/alerta-5xx \
  -H "Content-Type: application/json" \
  -d '{"type":"5xx_error","message":"Internal Server Error","route":"/api/test","statusCode":500}'
# Esperado: alerta no Slack/WhatsApp se críticos
```

### WF-05 — Integração Poll
```bash
# Trigger manual
curl -X POST http://localhost:5678/webhook/alerta-5xx \
  -H "Content-Type: application/json" \
  -d '{"type":"integration_status_500","statusCode":500,"error":"column mode does not exist","route":"/api/integrations/status"}'
# Esperado: alerta crítico
```

---

## 6. Backup e Restore

### Backup (diário via cron ou manual)
```bash
# Exportar workflows
curl -H "X-N8N-API-KEY: $API_KEY" \
  http://localhost:5678/api/v1/workflows > backup/workflows_$(date +%F).json

# Backup DB n8n
docker exec rx-n8n-db pg_dump -U n8n n8n > backup/n8n_db_$(date +%F).sql
```

### Restore
```bash
# DB
cat backup/n8n_db_2026-10-31.sql | docker exec -i rx-n8n-db psql -U n8n n8n

# Workflows (reimportar via UI ou API)
```

---

## 7. Troubleshooting

| Sintoma | Causa Provável | Ação |
|---|---|---|
| `healthz` não responde | Container n8n não healthy | `docker logs rx-n8n` → checar erros de conexão com `rx-n8n-db` |
| Workflow não ativa | JSON inválido ou dependências | Validar JSON; checar se nodes referenciam envs existentes |
| Webhook retorna 404 | Workflow não ativo ou path errado | Verificar `webhookId` no JSON e se workflow está Active |
| CAPI retorna 401 | `META_CAPI_ACCESS_TOKEN` inválido/expirado | Renovar token no Meta Developer Console |
| Drift detectado falsamente | Endpoint `/api/admin/schema/diff` não implementado | Implementar endpoint ou ajustar workflow para pular |

---

## 8. Próximos Passos (após este turno)

1. [ ] Implementar `/api/admin/alerts` (POST) — gravar em tabela `admin_alerts` + notificar
2. [ ] Implementar `/api/admin/schema/diff` (GET) — `prisma migrate diff` local vs prod
3. [ ] Implementar `/api/admin/notify-slack` + `/api/admin/notify-whatsapp`
4. [ ] Adicionar `ADMIN_ALERT_TOKEN`, `ALERT_WHATSAPP_NUMBER`, `SLACK_ALERT_CHANNEL` ao `.env.local` e hPanel
5. [ ] Testar todos os 5 workflows ativos e verdes
6. [ ] Commitar `n8n/` (workflows + docker-compose + docs/N8N.md)
7. [ ] Configurar cron de backup no Hostinger ou GitHub Actions

---

> **Atualizado em:** 2026-10-31 | **Versão n8n:** 1.100.0 | **Stack:** n8n + Postgres 17 dedicado