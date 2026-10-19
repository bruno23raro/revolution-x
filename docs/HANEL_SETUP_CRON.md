# Runbook — Cron do agendador TikTok (FASE 4 · slice 3, [HUMANO])

O código está no ar (commit `042ec94`): o runner multi-tenant
(`runTikTokCronForAll`) e a rota `POST /api/cron/tiktok` — protegida pelo
segredo `CRON_SECRET`, degradação honesta (503 `cron_not_configured`) até
os passos abaixo. Sem segredo, use o gatilho manual: card "Agendados" em
`/tiktok` → "Processar agendados" (`POST /api/tiktok/tick`, com auth).

> **Nenhum segredo fica versionado neste arquivo** — gere e cole no hpanel
> (mesmo padrão do runbook de rotação de banco: só passos, só nomes).

## Passos

### 1. Gerar o segredo (local, fora do chat/repo)

```bash
# qualquer um dos dois gera um segredo forte de 64 hex:
openssl rand -hex 32
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guarde o valor — ele vai **só** para o campo de env do hpanel.

### 2. Definir a env no hpanel do Hostinger

Hostinger → *Websites* → revolutionx.com.br → *Node.js* → **Environment
Variables** → adicionar:

| Nome | Valor |
| --- | --- |
| `CRON_SECRET` | *(o segredo gerado no passo 1)* |

Aplicar um re-deploy do app (hpanel *Redeploy*) para a env entrar no
processo.

### 3. Registrar o job de cron (hpanel)

Hostinger → *Websites* → revolutionx.com.br → **Cron Jobs**:

| Campo | Valor |
| --- | --- |
| Período | *Every 5 minutes* |
| Comando | `curl -fsS -X POST -H "x-cron-secret: <SEGREDO>" https://revolutionx.com.br/api/cron/tiktok >/dev/null` |

(5 min casa com a base do backoff do slice 2; ajuste se quiser outro
ritmo. O comando não escreve o segredo em log — o redireciona p/
`/dev/null`; o hpanel guarda só a linha do job.)

### 4. Verificar (progressão esperada)

```bash
# sem segredo / errado → 401
curl -i -X POST -H "x-cron-secret: errado" https://revolutionx.com.br/api/cron/tiktok
# → 401 {"ok":false,"error":"unauthorized",...}

# env ausente antes do re-deploy → 503 cron_not_configured
curl -i -X POST https://revolutionx.com.br/api/cron/tiktok
# → 503 {"ok":false,"error":"cron_not_configured",...}

# segredo certo → 200 com a agregação
curl -s -X POST -H "x-cron-secret: <SEGREDO>" https://revolutionx.com.br/api/cron/tiktok
# → {"ok":true,"tenants":0,"published":0,"failed":0,"retried":0,"reasons":[]}
#   (sem pendências, `tenants` = 0 é o estado saudável)
```

Com pendências, `tenants/published/retried/failed` refletem o que o cron
processou; `reasons` traz os motivos honestos (por tenant) quando algo
falhou — **o segredo nunca aparece nas respostas**.

## Se o usuário fornecer `REDIS_URL` / `INNGEST_*` (opcional, futuro)

O contrato `TickDeps` (`src/jobs/tiktokScheduler.ts`) é o ponto de
extensão: um adaptador BullMQ ou Inngest alimenta o **mesmo** executor —
o código do núcleo não muda. O cron do hpanel acima continua valendo
como gatilho de último recurso enquanto a fila nativa (AgentMemory)
perdura como backend.
