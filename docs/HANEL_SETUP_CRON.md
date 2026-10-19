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

### 5. Se algo der errado (diagnóstico à prova de erro)

Leia **o corpo JSON** (campo `error`), não só o HTTP — num cron com
falha por tenant o HTTP é `200` mas `ok:false`. Cada combinação tem uma
causa conhecida e uma ação concreta:

| O que você vê (`HTTP` / `error`) | O que significa | Ação [HUMANO] |
| --- | --- | --- |
| `401` / `unauthorized` | `x-cron-secret` ausente, errado ou trocado | Confira se o segredo **do comando do cron** (passo 3) é **idêntico** ao da env `CRON_SECRET` (passo 2). Um espaço a mais já derruba. Gere de novo e recolo nos dois lugares. |
| `503` / `cron_not_configured` | A env `CRON_SECRET` ainda não está no processo | Complete o passo 2 **e** rode o *Redeploy*. (Isto é o que aparece no hpanel antes do re-deploy pegar a env.) |
| `405` / `method_not_allowed` | O gatilho usou o método errado (GET/PUT) | O cron **deve** ser `POST`. Verifique o comando do hpanel (`curl -X POST`). O browser não é um gatilho válido. |
| `503` / `queue_unavailable` | A fila nativa (AgentMemory/Supabase) está inacessível | Banco fora/latência? Confira o health do Supabase. A intenção **já está preservada** — o próximo tick volta a tentar, sem perda. |
| `500` / `list_failed` | A descoberta (varredura) falhou (erro de DB genérico) | Mesmo de cima: verifique o banco. Retenta no tick seguinte. |
| `500` / `tick_failed` | Defesa defensiva — o runner "deveria" nunca lançar | Raro. Confira os logs do app (hpanel *Logs*). Em regra é transitório; o próximo tick segue. |
| `200` / `ok:true, tenants:0` | Estado saudável: nenhum usuário tem pendência | Nada a fazer. É o caso normal. |
| `200` / `ok:true, retried>0` | Falha transitória foi **reagendada** (backoff do slice 2) | Saudável — não é erro terminal. O item volta a ser tentado no próximo tick vencido. |
| `200` / `ok:false, tenant_failed` | 1+ tenant terminou com falha; `reasons` explica quem/quê | Tenants saudáveis **já foram processados** (isolamento por tenant). Leia `reasons`, e para o pendurado: confira a intenção no card "Agendados" (`/tiktok`) e corrija a causa (ex. token TikTok expirado). |
| `200` / `failed>0` | Tentativas esgotadas (máx. 3) em 1+ post | O post virou `failed` terminal. Reagende a intenção de novo (novo post) após corrigir a causa; não re-tenta sozinho. |

**Verificação rápida do pipeline sem tocar em produção:** o card
"Agendados" em `/tiktok` (gatilho manual `POST /api/tiktok/tick`, com
sessão de usuário) exercita o **mesmo** executor do cron — útil para
confirmar publicação/retry antes de depender só do agendador do hpanel.

## Se o usuário fornecer `REDIS_URL` / `INNGEST_*` (opcional, futuro)

O contrato `TickDeps` (`src/jobs/tiktokScheduler.ts`) é o ponto de
extensão: um adaptador BullMQ ou Inngest alimenta o **mesmo** executor —
o código do núcleo não muda. O cron do hpanel acima continua valendo
como gatilho de último recurso enquanto a fila nativa (AgentMemory)
perdura como backend.
